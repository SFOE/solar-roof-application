"""
Lambda proxy for the VESE PV tariff API.

Routes (API Gateway HTTP API, payload format 2.0):
  GET /muni?idofs=XXXX        -> list the electricity providers (EVU) of a municipality
  GET /evu?evuId=XXX&year=YY  -> tariff of an EVU

The VESE license key is never stored in code, in git or in a Lambda environment
variable. It lives in AWS Secrets Manager: only the secret ARN is passed to the
Lambda (VESE_SECRET_ARN). The key is cached across warm invocations.

CORS is handled by the API Gateway (cors_configuration in the infrastructure).
With a CORS configuration, API Gateway ignores any CORS header returned by the
Lambda, so none is set here.
"""

import json
import logging
import os
import urllib.error
import urllib.request
from urllib.parse import urlencode

import boto3
from botocore.exceptions import ClientError

VESE_BASE_URL = "https://opendata.vese.ch/pvtarif/api/getData"

# Logging: the Lambda runs with the JSON log format (see the infrastructure), so the keys
# passed in `extra` become JSON fields. The "event" field is counted by CloudWatch metric
# filters that raise the alarms. If you rename an event, change the filters in the
# infrastructure repository (monitoring.tf).
#   secret_unavailable  : the VESE key cannot be read from Secrets Manager
#   vese_auth_rejected  : VESE answers 401/403 (key refused)
#   vese_http_error     : VESE answers another HTTP error (field upstream_status)
#   vese_unreachable    : timeout, DNS or TLS error when calling VESE
# Never log the URL, the key or an exception text: they can contain the key.
logger = logging.getLogger(__name__)

_secrets_client = boto3.client("secretsmanager")
_cached_api_key = None


def get_api_key():
    """Return the VESE key from Secrets Manager (cached), or None if unavailable.

    The secret is either the raw key or a JSON object {"VESE_API_KEY": "<key>"}. The
    field name is matched without regard to case, because the secret itself is called
    vese_api_key and the same name is easy to type as the field.
    """
    global _cached_api_key
    if _cached_api_key:
        return _cached_api_key

    secret_id = os.environ.get("VESE_SECRET_ARN")
    if not secret_id:
        logger.error(
            "VESE_SECRET_ARN is not set", extra={"cause": "no_secret_arn"}
        )
        return None

    try:
        secret = _secrets_client.get_secret_value(SecretId=secret_id).get(
            "SecretString"
        )
    except ClientError as e:
        logger.error(
            "Cannot read the VESE secret",
            extra={"cause": e.response["Error"]["Code"]},
        )
        return None
    if not secret:
        logger.error("The VESE secret is empty", extra={"cause": "empty_secret"})
        return None

    secret = secret.strip()
    if secret.startswith("{"):
        try:
            fields = json.loads(secret)
        except ValueError:
            logger.error(
                "The VESE secret is not valid JSON", extra={"cause": "invalid_json"}
            )
            return None
        secret = None
        if isinstance(fields, dict):
            secret = next(
                (v for k, v in fields.items() if str(k).upper() == "VESE_API_KEY"),
                None,
            )
        if not secret:
            logger.error(
                "The VESE secret has no VESE_API_KEY field",
                extra={"cause": "missing_field"},
            )
            return None

    _cached_api_key = secret or None
    return _cached_api_key


def lambda_handler(event, context):
    api_key = get_api_key()
    if not api_key:
        logger.error(
            "VESE API key not available", extra={"event": "secret_unavailable"}
        )
        return error_response(500, "API key not configured")

    raw_path = event.get("rawPath", "")
    params = event.get("queryStringParameters") or {}

    if raw_path.endswith("/muni"):
        return handle_muni(params, api_key)
    if raw_path.endswith("/evu"):
        return handle_evu(params, api_key)
    return error_response(404, "Unknown route")


def handle_muni(params, api_key):
    """Get the list of EVUs for a municipality."""
    idofs = params.get("idofs")
    if not idofs or not idofs.isdigit():
        return error_response(400, "Missing or invalid 'idofs' parameter")

    return proxy_request("muni", {"idofs": idofs}, api_key)


def handle_evu(params, api_key):
    """Get the tariff data of an EVU."""
    evu_id = params.get("evuId")
    year = params.get("year")

    if not evu_id:
        return error_response(400, "Missing 'evuId' parameter")
    if not year or not year.isdigit():
        return error_response(400, "Missing or invalid 'year' parameter")

    return proxy_request("evu", {"evuId": evu_id, "year": year}, api_key)


def proxy_request(path, params, api_key):
    """Call the VESE API and return its response (the license key is added here)."""
    url = f"{VESE_BASE_URL}/{path}?{urlencode({**params, 'licenseKey': api_key})}"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            # VESE injects BOM characters into its JSON responses
            data = response.read().decode("utf-8").replace("\ufeff", "")
    except urllib.error.HTTPError as e:
        auth_rejected = e.code in (401, 403)
        # A 4xx caused by a bad parameter is a warning; an auth refusal or a 5xx is an error.
        level = logging.ERROR if auth_rejected or e.code >= 500 else logging.WARNING
        logger.log(
            level,
            "VESE API answered with an HTTP error",
            extra={
                "event": "vese_auth_rejected" if auth_rejected else "vese_http_error",
                "upstream_status": e.code,
                "vese_path": path,
            },
        )
        return error_response(e.code, f"VESE API error: {e.code}")
    except Exception as e:
        # Never return or log the exception text: it could contain the URL (and the key).
        logger.error(
            "VESE API unreachable",
            extra={
                "event": "vese_unreachable",
                "error_type": type(e).__name__,
                "vese_path": path,
            },
        )
        return error_response(502, "Failed to reach VESE API")

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=86400",
        },
        "body": data,
    }


def error_response(status_code, message):
    """Return a standardized JSON error response."""
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": message}),
    }
