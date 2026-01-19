"""DaData API client for INN and BIK lookup.

DaData (dadata.ru) provides company/individual info by INN
and bank info by BIK.

API docs: https://dadata.ru/api/
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Union

import httpx

from app.core.config import settings


logger = logging.getLogger(__name__)


class LegalType(str, Enum):
    """Legal entity type"""
    INDIVIDUAL = "INDIVIDUAL"  # ИП
    LEGAL = "LEGAL"  # ООО, АО, etc.


class CompanyStatus(str, Enum):
    """Company status from DaData"""
    ACTIVE = "ACTIVE"
    LIQUIDATING = "LIQUIDATING"
    LIQUIDATED = "LIQUIDATED"
    BANKRUPT = "BANKRUPT"
    REORGANIZING = "REORGANIZING"


@dataclass
class CompanyInfo:
    """Company information from DaData"""
    # Required fields (no defaults)
    name: str  # Short name
    full_name: str  # Full official name
    inn: str
    # Optional fields (with defaults)
    kpp: Optional[str] = None  # KPP (only for legal entities)
    ogrn: Optional[str] = None  # OGRN/OGRNIP
    address: Optional[str] = None
    legal_type: Optional[LegalType] = None
    status: Optional[CompanyStatus] = None
    management_name: Optional[str] = None  # Director/CEO name
    management_post: Optional[str] = None  # Director position


@dataclass
class BankInfo:
    """Bank information from DaData"""
    # Required fields (no defaults)
    name: str  # Bank short name
    bik: str
    # Optional fields (with defaults)
    full_name: Optional[str] = None  # Bank full name
    corr_account: Optional[str] = None  # Correspondent account
    address: Optional[str] = None
    swift: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None


@dataclass
class DaDataResponse:
    """Response wrapper from DaData API"""
    success: bool = False
    data: Optional[Union[CompanyInfo, BankInfo]] = None
    error_message: Optional[str] = None
    raw_response: Optional[dict] = field(default=None, repr=False)


# Mock data for development
MOCK_COMPANIES = {
    "7707083893": CompanyInfo(
        name='ПАО Сбербанк',
        full_name='ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "СБЕРБАНК РОССИИ"',
        inn="7707083893",
        kpp="773601001",
        ogrn="1027700132195",
        address="117312, г Москва, ул Вавилова, д 19",
        legal_type=LegalType.LEGAL,
        status=CompanyStatus.ACTIVE,
        management_name="Греф Герман Оскарович",
        management_post="Президент, Председатель Правления",
    ),
    "7710140679": CompanyInfo(
        name='ПАО Банк ВТБ',
        full_name='ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "БАНК ВТБ"',
        inn="7710140679",
        kpp="770943002",
        ogrn="1027739609391",
        address="123112, г Москва, наб Пресненская, д 12",
        legal_type=LegalType.LEGAL,
        status=CompanyStatus.ACTIVE,
        management_name="Костин Андрей Леонидович",
        management_post="Президент-Председатель Правления",
    ),
    "5190237491": CompanyInfo(
        name='ООО "Сектор ИТ"',
        full_name='ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "СЕКТОР ИТ"',
        inn="5190237491",
        kpp="519001001",
        ogrn="1255100001496",
        address="183008, Мурманская область, г Мурманск, ул Олега Кошевого, д 6 к 1, помещ 1",
        legal_type=LegalType.LEGAL,
        status=CompanyStatus.ACTIVE,
    ),
    # Individual entrepreneur example (valid checksum)
    "772879317683": CompanyInfo(
        name="ИП Иванов Иван Иванович",
        full_name="ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ИВАНОВ ИВАН ИВАНОВИЧ",
        inn="772879317683",
        kpp=None,
        ogrn="318774600428674",
        address="125009, г Москва, ул Тверская, д 1",
        legal_type=LegalType.INDIVIDUAL,
        status=CompanyStatus.ACTIVE,
    ),
}

MOCK_BANKS = {
    "044525225": BankInfo(
        name="Сбербанк",
        bik="044525225",
        full_name='ПАО "Сбербанк"',
        corr_account="30101810400000000225",
        address="117312, г Москва, ул Вавилова, д 19",
        swift="SABRRUMM",
        inn="7707083893",
        kpp="773601001",
    ),
    "044525187": BankInfo(
        name="Банк ВТБ",
        bik="044525187",
        full_name='ПАО "Банк ВТБ"',
        corr_account="30101810700000000187",
        address="123112, г Москва, наб Пресненская, д 12",
        swift="VTBRRUM2",
        inn="7710140679",
        kpp="770943002",
    ),
    "044525974": BankInfo(
        name="Т-Банк",
        bik="044525974",
        full_name='АО "Тинькофф Банк"',
        corr_account="30101810145250000974",
        address="123060, г Москва, 1-й Волоколамский проезд, д 10, стр 1",
        swift="TICSRUMMXXX",
        inn="7710140679",
        kpp="773401001",
    ),
    "044525593": BankInfo(
        name="Альфа-Банк",
        bik="044525593",
        full_name='АО "Альфа-Банк"',
        corr_account="30101810200000000593",
        address="107078, г Москва, ул Каланчевская, д 27",
        swift="ALFARUMM",
        inn="7728168971",
        kpp="770801001",
    ),
}


class DaDataClient:
    """Client for DaData API.

    Usage:
        client = DaDataClient()
        result = await client.find_by_inn("7707083893")
        if result.success:
            print(result.data.name)
    """

    def __init__(self, api_key: Optional[str] = None, secret_key: Optional[str] = None):
        """Initialize DaData client.

        Args:
            api_key: DaData API key (uses settings if not provided)
            secret_key: DaData secret key (uses settings if not provided)
        """
        self.api_key = api_key or settings.DADATA_API_KEY
        self.secret_key = secret_key or settings.DADATA_SECRET_KEY
        self.base_url = settings.DADATA_API_URL
        self.mock_mode = settings.DADATA_MOCK_MODE

    def _get_headers(self) -> dict:
        """Get headers for DaData API requests."""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Token {self.api_key}",
            "X-Secret": self.secret_key,
        }

    async def find_by_inn(self, inn: str) -> DaDataResponse:
        """Find company/individual by INN.

        Args:
            inn: 10-digit (legal) or 12-digit (individual) INN

        Returns:
            DaDataResponse with CompanyInfo if found
        """
        inn = inn.strip()

        # Mock mode for development
        if self.mock_mode:
            return self._mock_find_by_inn(inn)

        # Real API call
        url = f"{self.base_url}/findById/party"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json={"query": inn}
                )
                response.raise_for_status()
                data = response.json()

                return self._parse_company_response(data)

        except httpx.HTTPStatusError as e:
            logger.error(f"DaData API error for INN {inn[:4]}****: {e}")
            return DaDataResponse(
                success=False,
                error_message=f"API error: {e.response.status_code}"
            )
        except httpx.RequestError as e:
            logger.error(f"DaData request error for INN {inn[:4]}****: {e}")
            return DaDataResponse(
                success=False,
                error_message=f"Request error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error in DaData find_by_inn: {e}")
            return DaDataResponse(
                success=False,
                error_message=f"Unexpected error: {str(e)}"
            )

    async def find_bank_by_bik(self, bik: str) -> DaDataResponse:
        """Find bank by BIK.

        Args:
            bik: 9-digit BIK code

        Returns:
            DaDataResponse with BankInfo if found
        """
        bik = bik.strip()

        # Mock mode for development
        if self.mock_mode:
            return self._mock_find_bank_by_bik(bik)

        # Real API call
        url = f"{self.base_url}/findById/bank"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json={"query": bik}
                )
                response.raise_for_status()
                data = response.json()

                return self._parse_bank_response(data)

        except httpx.HTTPStatusError as e:
            logger.error(f"DaData API error for BIK {bik}: {e}")
            return DaDataResponse(
                success=False,
                error_message=f"API error: {e.response.status_code}"
            )
        except httpx.RequestError as e:
            logger.error(f"DaData request error for BIK {bik}: {e}")
            return DaDataResponse(
                success=False,
                error_message=f"Request error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error in DaData find_bank_by_bik: {e}")
            return DaDataResponse(
                success=False,
                error_message=f"Unexpected error: {str(e)}"
            )

    def _mock_find_by_inn(self, inn: str) -> DaDataResponse:
        """Mock implementation for development."""
        if inn in MOCK_COMPANIES:
            logger.info(f"[MOCK] Found company by INN: {inn[:4]}****")
            return DaDataResponse(
                success=True,
                data=MOCK_COMPANIES[inn]
            )

        logger.info(f"[MOCK] Company not found by INN: {inn[:4]}****")
        return DaDataResponse(
            success=False,
            error_message="Company not found"
        )

    def _mock_find_bank_by_bik(self, bik: str) -> DaDataResponse:
        """Mock implementation for development."""
        if bik in MOCK_BANKS:
            logger.info(f"[MOCK] Found bank by BIK: {bik}")
            return DaDataResponse(
                success=True,
                data=MOCK_BANKS[bik]
            )

        logger.info(f"[MOCK] Bank not found by BIK: {bik}")
        return DaDataResponse(
            success=False,
            error_message="Bank not found"
        )

    def _parse_company_response(self, data: dict) -> DaDataResponse:
        """Parse DaData company response."""
        suggestions = data.get("suggestions", [])

        if not suggestions:
            return DaDataResponse(
                success=False,
                error_message="Company not found",
                raw_response=data
            )

        # Take first suggestion
        suggestion = suggestions[0]
        company_data = suggestion.get("data", {})

        # Determine legal type
        legal_type = None
        type_value = company_data.get("type")
        if type_value == "INDIVIDUAL":
            legal_type = LegalType.INDIVIDUAL
        elif type_value == "LEGAL":
            legal_type = LegalType.LEGAL

        # Determine status
        status = None
        state = company_data.get("state", {})
        status_value = state.get("status")
        if status_value:
            try:
                status = CompanyStatus(status_value)
            except ValueError:
                pass

        # Extract management info
        management = company_data.get("management", {})

        company = CompanyInfo(
            name=company_data.get("name", {}).get("short_with_opf", "") or suggestion.get("value", ""),
            full_name=company_data.get("name", {}).get("full_with_opf", "") or suggestion.get("value", ""),
            inn=company_data.get("inn", ""),
            kpp=company_data.get("kpp"),
            ogrn=company_data.get("ogrn"),
            address=company_data.get("address", {}).get("value"),
            legal_type=legal_type,
            status=status,
            management_name=management.get("name"),
            management_post=management.get("post"),
        )

        return DaDataResponse(
            success=True,
            data=company,
            raw_response=data
        )

    def _parse_bank_response(self, data: dict) -> DaDataResponse:
        """Parse DaData bank response."""
        suggestions = data.get("suggestions", [])

        if not suggestions:
            return DaDataResponse(
                success=False,
                error_message="Bank not found",
                raw_response=data
            )

        # Take first suggestion
        suggestion = suggestions[0]
        bank_data = suggestion.get("data", {})

        bank = BankInfo(
            name=bank_data.get("name", {}).get("short", "") or suggestion.get("value", ""),
            full_name=bank_data.get("name", {}).get("full"),
            bik=bank_data.get("bic", ""),
            corr_account=bank_data.get("correspondent_account"),
            address=bank_data.get("address", {}).get("value"),
            swift=bank_data.get("swift"),
            inn=bank_data.get("inn"),
            kpp=bank_data.get("kpp"),
        )

        return DaDataResponse(
            success=True,
            data=bank,
            raw_response=data
        )
