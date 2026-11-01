from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Custom permission to allow access only to authenticated administrators (is_staff or is_superuser)
    whose accounts are active.
    """

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_active and
            (request.user.is_staff or request.user.is_superuser)
        )
