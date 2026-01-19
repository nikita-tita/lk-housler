"""
PII utility functions: masking, normalization, validation.
"""

import re


def normalize_phone(phone: str) -> str:
    """
    Normalize phone number to consistent format.

    - Removes all non-digits
    - Converts 8xxx to 7xxx (Russia)
    - Adds 7 prefix for 10-digit numbers

    Examples:
        "+7 (999) 123-45-67" -> "79991234567"
        "8-999-123-45-67" -> "79991234567"
        "9991234567" -> "79991234567"
    """
    if not phone:
        return ""

    # Keep only digits
    digits = re.sub(r"\D", "", phone)

    # Convert 8 to 7 for Russian numbers
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]

    # Add 7 for 10-digit numbers
    if len(digits) == 10:
        digits = "7" + digits

    return digits


def normalize_email(email: str) -> str:
    """
    Normalize email for consistent hashing.

    - Lowercase
    - Strip whitespace
    """
    if not email:
        return ""
    return email.lower().strip()


class _Mask:
    """
    PII masking utilities for logging and display.

    Usage:
        from housler_crypto import mask

        mask.email("test@example.com")  # "te***@example.com"
        mask.phone("+79991234567")      # "+7***4567"
        mask.name("Иван Иванов")        # "Ив*** Ив***"
    """

    @staticmethod
    def email(email: str) -> str:
        """
        Mask email: te***@example.com

        Shows first 2 chars of local part, full domain.
        """
        if not email or "@" not in email:
            return "***"

        local, domain = email.split("@", 1)
        if len(local) <= 2:
            masked_local = "***"
        else:
            masked_local = local[:2] + "***"

        return f"{masked_local}@{domain}"

    @staticmethod
    def phone(phone: str) -> str:
        """
        Mask phone: +7***4567

        Shows first 2 chars and last 4 digits.
        """
        if not phone:
            return "***"

        digits = re.sub(r"\D", "", phone)
        if len(digits) < 4:
            return "***"

        # Keep format prefix if present
        prefix = ""
        if phone.startswith("+"):
            prefix = "+"

        return f"{prefix}{digits[:1]}***{digits[-4:]}"

    @staticmethod
    def name(name: str) -> str:
        """
        Mask name: Ив*** П***

        Shows first 2 chars of each word.
        """
        if not name:
            return "***"

        parts = name.split()
        masked = []
        for part in parts:
            if len(part) <= 2:
                masked.append("***")
            else:
                masked.append(part[:2] + "***")

        return " ".join(masked)

    @staticmethod
    def inn(inn: str) -> str:
        """
        Mask INN: 77***1234

        Shows first 2 and last 4 digits.
        """
        if not inn:
            return "***"

        digits = re.sub(r"\D", "", inn)
        if len(digits) < 6:
            return "***"

        return f"{digits[:2]}***{digits[-4:]}"

    @staticmethod
    def passport(series: str, number: str) -> str:
        """
        Mask passport: ** ** ******

        Fully masked for security.
        """
        return "** ** ******"

    @staticmethod
    def card(card_number: str) -> str:
        """
        Mask card: **** **** **** 1234

        Shows only last 4 digits (PCI DSS compliant).
        """
        if not card_number:
            return "***"

        digits = re.sub(r"\D", "", card_number)
        if len(digits) < 4:
            return "***"

        return f"**** **** **** {digits[-4:]}"


# Singleton instance
mask = _Mask()


def validate_email(email: str) -> bool:
    """Basic email validation."""
    if not email:
        return False
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """Basic Russian phone validation (10-11 digits)."""
    if not phone:
        return False
    digits = re.sub(r"\D", "", phone)
    return len(digits) in (10, 11)


def validate_inn(inn: str) -> bool:
    """Basic INN validation (10 or 12 digits for Russia)."""
    if not inn:
        return False
    digits = re.sub(r"\D", "", inn)
    return len(digits) in (10, 12)
