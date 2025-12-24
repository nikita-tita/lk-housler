"""SMS provider interface and implementations"""

from abc import ABC, abstractmethod
from typing import Optional

from app.core.config import settings


class SMSProvider(ABC):
    """Abstract SMS provider"""
    
    @abstractmethod
    async def send(self, phone: str, message: str) -> bool:
        """Send SMS"""
        pass


class MockSMSProvider(SMSProvider):
    """Mock SMS provider for development"""

    async def send(self, phone: str, message: str) -> bool:
        """Mock send - log without exposing OTP code"""
        # SECURITY: Never log OTP codes, only log the fact of sending
        print(f"[SMS Mock] SMS sent to: {phone} (message content hidden)")
        return True


class SMSRuProvider(SMSProvider):
    """SMS.RU provider for Housler ecosystem"""
    
    def __init__(self, api_id: str, test_mode: bool = False):
        self.api_id = api_id
        self.test_mode = test_mode
        self.base_url = "https://sms.ru"
    
    async def send(self, phone: str, message: str) -> bool:
        """Send SMS via SMS.RU API"""
        import httpx
        
        # Remove + from phone if present
        phone = phone.lstrip('+')
        
        # Test mode: accept test phone numbers 79999000000-79999999999
        if self.test_mode and phone.startswith('79999'):
            # SECURITY: Never log OTP codes, only log the fact of sending
            print(f"[SMS.RU Test Mode] SMS sent to: {phone} (message content hidden)")
            return True
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sms/send",
                    data={
                        "api_id": self.api_id,
                        "to": phone,
                        "msg": message,
                        "json": 1,
                    },
                    timeout=10.0
                )
                
                result = response.json()
                
                if result.get("status") == "OK":
                    print(f"[SMS.RU] Sent to {phone}, SMS ID: {result.get('sms', {}).get(phone, {}).get('sms_id')}")
                    return True
                else:
                    error_code = result.get("status_code")
                    error_text = result.get("status_text", "Unknown error")
                    print(f"[SMS.RU Error] Code: {error_code}, Text: {error_text}")
                    return False
                    
        except Exception as e:
            print(f"[SMS.RU Exception] {str(e)}")
            return False
    
    async def check_balance(self) -> float:
        """Check SMS.RU balance"""
        import httpx
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/my/balance",
                    params={"api_id": self.api_id},
                    timeout=10.0
                )
                result = response.json()
                
                if result.get("status") == "OK":
                    balance = float(result.get("balance", 0))
                    print(f"[SMS.RU] Balance: {balance} RUB")
                    return balance
                    
        except Exception as e:
            print(f"[SMS.RU Balance Check Exception] {str(e)}")
            
        return 0.0


def get_sms_provider() -> SMSProvider:
    """Get SMS provider based on settings"""
    if settings.SMS_PROVIDER == "mock":
        return MockSMSProvider()
    elif settings.SMS_PROVIDER == "sms_ru":
        return SMSRuProvider(
            api_id=settings.SMS_RU_API_ID,
            test_mode=settings.SMS_TEST_MODE
        )
    else:
        # Fallback to mock if provider unknown
        print(f"[Warning] Unknown SMS provider: {settings.SMS_PROVIDER}, using Mock")
        return MockSMSProvider()

