"""FNS (Federal Tax Service) integrations"""

from app.integrations.fns.npd_status import NPDStatusChecker, NPDStatus

__all__ = ["NPDStatusChecker", "NPDStatus"]
