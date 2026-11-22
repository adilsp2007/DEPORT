import logging
from django.core.exceptions import ValidationError as DjangoValidationError, PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger('django')


def custom_exception_handler(exc, context):
    """
    Standardized Django REST Framework exception handler for DEPORT.
    Ensures all error responses across the DEPORT API follow a unified, user-friendly structure:
    {
      "success": false,
      "message": "User-friendly summary",
      "detail": "User-friendly summary",
      "errors": { "field": ["error message"] }
    }
    - Never leaks server tracebacks, DB internals, filesystem paths, or secrets to clients.
    - Gracefully handles Django Core exceptions (ValidationError, IntegrityError, Http404, PermissionDenied).
    - Normalizes SimpleJWT token errors and standard status messages into user-friendly text.
    - Guarantees both 'message' and 'detail' strings exist on all error responses.
    """
    # 1. First, call DRF's standard exception handler
    response = exception_handler(exc, context)

    view = context.get('view', None)
    view_name = view.__class__.__name__ if view else 'UnknownView'
    request = context.get('request', None)
    path = request.path if request else 'UnknownPath'
    method = request.method if request else 'UnknownMethod'

    # 2. If DRF did not handle the exception (returned None), handle Django/Python exceptions
    if response is None:
        # Handle Django Core ValidationError
        if isinstance(exc, DjangoValidationError):
            errors = {}
            if hasattr(exc, 'message_dict'):
                for k, v in exc.message_dict.items():
                    errors[k] = list(v) if isinstance(v, (list, tuple)) else [str(v)]
            elif hasattr(exc, 'messages'):
                errors = {'non_field_errors': list(exc.messages)}
            else:
                errors = {'detail': [str(exc)]}

            first_error = 'Please correct the highlighted fields.'
            for field, msgs in errors.items():
                if msgs and isinstance(msgs, (list, tuple)):
                    first_error = str(msgs[0])
                    break

            data = {
                'success': False,
                'message': first_error,
                'detail': first_error,
                'errors': errors,
                **errors
            }
            return Response(data, status=status.HTTP_400_BAD_REQUEST)

        # Handle Database Integrity Errors (e.g. duplicate key, foreign key constraint)
        if isinstance(exc, IntegrityError):
            err_str = str(exc).lower()
            logger.warning(f"IntegrityError in {method} {path} ({view_name}): {exc}")

            if 'unique' in err_str or 'duplicate' in err_str:
                field_name = 'non_field_errors'
                msg = 'A record with this information already exists.'
                if 'category' in err_str or 'categories' in path:
                    field_name = 'name'
                    msg = 'This category already exists.'
                elif 'coupon' in err_str or 'coupons' in path:
                    field_name = 'code'
                    msg = 'A coupon with this code already exists.'
                elif 'product' in err_str or 'products' in path:
                    if 'sku' in err_str:
                        field_name = 'sku'
                        msg = 'A product with this SKU already exists.'
                    else:
                        field_name = 'name'
                        msg = 'A product with this name already exists.'

                errors = {field_name: [msg]}
                return Response({
                    'success': False,
                    'message': msg,
                    'detail': msg,
                    'code': 'duplicate_entry',
                    'errors': errors,
                    **errors
                }, status=status.HTTP_409_CONFLICT)

            msg = 'Unable to complete operation due to data constraints.'
            return Response({
                'success': False,
                'message': msg,
                'detail': msg,
                'code': 'integrity_error',
                'errors': {'non_field_errors': [msg]}
            }, status=status.HTTP_400_BAD_REQUEST)

        # Handle Http404 Not Found
        if isinstance(exc, Http404):
            msg = 'The requested record was not found.'
            return Response({
                'success': False,
                'message': msg,
                'detail': msg,
                'code': 'not_found',
                'errors': {'detail': [msg]}
            }, status=status.HTTP_404_NOT_FOUND)

        # Handle PermissionDenied
        if isinstance(exc, PermissionDenied):
            msg = 'You do not have permission to perform this action.'
            return Response({
                'success': False,
                'message': msg,
                'detail': msg,
                'code': 'permission_denied',
                'errors': {'detail': [msg]}
            }, status=status.HTTP_403_FORBIDDEN)

        # Unexpected server-side Python exception
        logger.error(
            f"Unhandled exception in {method} {path} ({view_name}): {type(exc).__name__} - {exc}",
            exc_info=True
        )
        msg = 'Something went wrong on our server. Please try again later.'
        return Response({
            'success': False,
            'message': msg,
            'detail': msg,
            'code': 'server_error',
            'errors': {'non_field_errors': [msg]}
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 3. If DRF handled the exception, format and normalize the response payload
    if response is not None:
        data = response.data
        errors_dict = {}
        primary_msg = None

        if isinstance(data, list):
            primary_msg = str(data[0]) if data else 'Invalid request.'
            errors_dict = {'non_field_errors': [str(item) for item in data]}
        elif isinstance(data, dict):
            # Check detail / message
            detail_val = data.get('detail')
            if detail_val:
                detail_str = str(detail_val)
                lower_detail = detail_str.lower()
                if 'given token not valid' in lower_detail or 'token is invalid' in lower_detail:
                    primary_msg = 'Your session has expired. Please log in again.'
                elif 'authentication credentials were not provided' in lower_detail:
                    primary_msg = 'Please log in again.'
                elif 'user not found' in lower_detail:
                    primary_msg = 'No account associated with this session was found.'
                elif response.status_code == status.HTTP_404_NOT_FOUND:
                    primary_msg = 'The requested record was not found.'
                elif response.status_code == status.HTTP_403_FORBIDDEN:
                    primary_msg = 'You do not have permission to perform this action.'
                else:
                    primary_msg = detail_str

            # Normalize field errors
            for k, v in data.items():
                if k in ['detail', 'messages']:
                    continue
                if k == 'code' and isinstance(v, str):
                    continue
                if isinstance(v, (list, tuple)):
                    errors_dict[k] = [str(item) for item in v]
                else:
                    errors_dict[k] = [str(v)]

            # If no primary message, pick the first error or summary
            if not primary_msg:
                if 'non_field_errors' in errors_dict and errors_dict['non_field_errors']:
                    primary_msg = errors_dict['non_field_errors'][0]
                elif errors_dict:
                    if len(errors_dict) > 1:
                        primary_msg = 'Please correct the highlighted fields.'
                    else:
                        first_field = list(errors_dict.keys())[0]
                        primary_msg = errors_dict[first_field][0]
                else:
                    primary_msg = 'Invalid request. Please verify the entered information.'

        else:
            primary_msg = str(data)
            errors_dict = {'detail': [primary_msg]}

        # Map generic status messages to table equivalents
        if response.status_code == status.HTTP_401_UNAUTHORIZED and not primary_msg:
            primary_msg = 'Please log in again.'
        elif response.status_code == status.HTTP_403_FORBIDDEN and not primary_msg:
            primary_msg = 'You do not have permission to perform this action.'
        elif response.status_code == status.HTTP_404_NOT_FOUND and not primary_msg:
            primary_msg = 'The requested record was not found.'
        elif response.status_code >= 500:
            primary_msg = 'Something went wrong. Please try again later.'

        # Normalize field errors messages matching table requirements:
        for field, err_list in errors_dict.items():
            normalized_list = []
            for item in err_list:
                item_lower = item.lower()
                if 'this field is required' in item_lower or 'this field may not be blank' in item_lower or 'this field may not be null' in item_lower:
                    normalized_list.append('This field is required.')
                elif 'please select a valid banner type' in item_lower or 'invalid banner type' in item_lower:
                    normalized_list.append('Please select a valid banner type.')
                elif 'end date must be later than start date' in item_lower:
                    normalized_list.append('End date must be later than start date.')
                else:
                    normalized_list.append(item)
            errors_dict[field] = normalized_list

        response.data = {
            'success': False,
            'message': primary_msg,
            'detail': primary_msg,
            'errors': errors_dict,
            **errors_dict
        }

    return response
