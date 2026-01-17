#!/usr/bin/env python3
"""
Manual test script for bank-split flow.

Tests the complete deal lifecycle:
1. Create deal
2. Submit for signing
3. Mark as signed
4. Create invoice (get payment link)
5. Simulate payment via webhook
6. Release from hold

Usage:
    # Against local server
    python3 scripts/test_bank_split_flow.py

    # Against remote server
    python3 scripts/test_bank_split_flow.py --base-url https://lk.housler.ru

    # With auth token
    python3 scripts/test_bank_split_flow.py --token "your-jwt-token"
"""

import argparse
import json
import sys
import time
from datetime import datetime
from uuid import UUID

import requests


class BankSplitTester:
    """Manual tester for bank-split API."""

    def __init__(self, base_url: str, token: str = None):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"
        self.session.headers["Content-Type"] = "application/json"

    def log(self, message: str, level: str = "INFO"):
        """Print colored log message."""
        colors = {
            "INFO": "\033[94m",
            "SUCCESS": "\033[92m",
            "ERROR": "\033[91m",
            "WARN": "\033[93m",
        }
        reset = "\033[0m"
        color = colors.get(level, "")
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"{color}[{timestamp}] [{level}] {message}{reset}")

    def create_deal(self) -> dict:
        """Step 1: Create a new bank-split deal."""
        self.log("Creating new bank-split deal...")

        payload = {
            "type": "secondary_buy",
            "property_address": "Moscow, Test Street 123, apt 45",
            "price": "15000000",  # 15M rubles
            "commission_total": "450000",  # 450K rubles (3%)
            "description": "Test deal for manual verification",
            "client_name": "Test Client",
            "client_phone": "+79991234567",
            "client_email": "test@example.com",
            # agent_split_percent not specified = 100% to agent (solo agent deal)
        }

        response = self.session.post(f"{self.base_url}/api/v1/bank-split", json=payload)

        if response.status_code == 201:
            deal = response.json()
            self.log(f"Deal created: {deal['id']}", "SUCCESS")
            self.log(f"  Status: {deal['status']}")
            self.log(f"  Payment model: {deal['payment_model']}")
            self.log(f"  Commission: {deal['commission_agent']} RUB")
            if deal.get("recipients"):
                self.log(f"  Recipients: {len(deal['recipients'])}")
                for r in deal["recipients"]:
                    self.log(f"    - {r['role']}: {r['split_value']}% = {r.get('calculated_amount', 'TBD')} RUB")
            return deal
        else:
            self.log(f"Failed to create deal: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return None

    def submit_for_signing(self, deal_id: str) -> dict:
        """Step 2: Submit deal for client signature."""
        self.log(f"Submitting deal {deal_id} for signing...")

        response = self.session.post(f"{self.base_url}/api/v1/bank-split/{deal_id}/submit-for-signing")

        if response.status_code == 200:
            result = response.json()
            self.log(f"Deal submitted: {result['old_status']} -> {result['new_status']}", "SUCCESS")
            return result
        else:
            self.log(f"Failed to submit: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return None

    def mark_signed(self, deal_id: str) -> dict:
        """Step 3: Mark deal as signed."""
        self.log(f"Marking deal {deal_id} as signed...")

        response = self.session.post(f"{self.base_url}/api/v1/bank-split/{deal_id}/mark-signed")

        if response.status_code == 200:
            result = response.json()
            self.log(f"Deal signed: {result['old_status']} -> {result['new_status']}", "SUCCESS")
            return result
        else:
            self.log(f"Failed to mark signed: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return None

    def create_invoice(self, deal_id: str, return_url: str = None) -> dict:
        """Step 4: Create invoice and get payment link."""
        self.log(f"Creating invoice for deal {deal_id}...")

        payload = {}
        if return_url:
            payload["return_url"] = return_url

        response = self.session.post(
            f"{self.base_url}/api/v1/bank-split/{deal_id}/create-invoice",
            json=payload if payload else None,
        )

        if response.status_code == 200:
            result = response.json()
            self.log("Invoice created!", "SUCCESS")
            self.log(f"  External ID: {result.get('external_deal_id')}")
            self.log(f"  Payment URL: {result.get('payment_url')}")
            self.log(f"  QR Code: {'Yes' if result.get('qr_code') else 'No'}")
            self.log(f"  Expires at: {result.get('expires_at')}")
            return result
        else:
            self.log(f"Failed to create invoice: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return None

    def simulate_payment_webhook(self, deal_id: str, amount: int = 45000000) -> dict:
        """Step 5: Simulate T-Bank payment webhook."""
        self.log(f"Simulating payment webhook for deal {deal_id}...")

        payload = {
            "TerminalKey": "test_terminal",
            "OrderId": deal_id,
            "PaymentId": f"test_payment_{int(time.time())}",
            "Amount": amount,  # In kopecks
            "Status": "CONFIRMED",
            "Success": True,
            "Token": "test_signature",
        }

        response = self.session.post(
            f"{self.base_url}/api/v1/bank-split/webhooks/tbank", json=payload
        )

        if response.status_code == 200:
            result = response.json()
            self.log("Webhook processed!", "SUCCESS")
            return result
        else:
            self.log(f"Webhook failed: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return None

    def release_from_hold(self, deal_id: str) -> dict:
        """Step 6: Release deal from hold period."""
        self.log(f"Releasing deal {deal_id} from hold...")

        response = self.session.post(f"{self.base_url}/api/v1/bank-split/{deal_id}/release")

        if response.status_code == 200:
            result = response.json()
            self.log(f"Deal released: {result['old_status']} -> {result['new_status']}", "SUCCESS")
            return result
        else:
            self.log(f"Failed to release: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return None

    def get_deal(self, deal_id: str) -> dict:
        """Get deal details."""
        response = self.session.get(f"{self.base_url}/api/v1/bank-split/{deal_id}")

        if response.status_code == 200:
            return response.json()
        else:
            self.log(f"Failed to get deal: {response.status_code}", "ERROR")
            return None

    def cancel_deal(self, deal_id: str, reason: str = "Test cancellation") -> dict:
        """Cancel a deal."""
        self.log(f"Cancelling deal {deal_id}...")

        response = self.session.post(
            f"{self.base_url}/api/v1/bank-split/{deal_id}/cancel",
            json={"reason": reason},
        )

        if response.status_code == 200:
            result = response.json()
            self.log(f"Deal cancelled: {result['old_status']} -> {result['new_status']}", "SUCCESS")
            return result
        else:
            self.log(f"Failed to cancel: {response.status_code}", "ERROR")
            return None

    def run_full_flow(self):
        """Run the complete bank-split flow."""
        self.log("=" * 60)
        self.log("Starting bank-split flow test")
        self.log("=" * 60)

        # Step 1: Create deal
        deal = self.create_deal()
        if not deal:
            self.log("Flow failed at step 1: create deal", "ERROR")
            return False

        deal_id = deal["id"]

        # Step 2: Submit for signing
        result = self.submit_for_signing(deal_id)
        if not result:
            self.log("Flow failed at step 2: submit for signing", "ERROR")
            return False

        # Step 3: Mark as signed
        result = self.mark_signed(deal_id)
        if not result:
            self.log("Flow failed at step 3: mark signed", "ERROR")
            return False

        # Step 4: Create invoice
        invoice = self.create_invoice(deal_id, return_url="https://lk.housler.ru/deals")
        if not invoice:
            self.log("Flow failed at step 4: create invoice", "ERROR")
            return False

        # Step 5: Simulate payment
        result = self.simulate_payment_webhook(deal_id)
        if not result:
            self.log("Flow failed at step 5: payment webhook", "ERROR")
            return False

        # Check deal status after payment
        deal = self.get_deal(deal_id)
        if deal:
            self.log(f"Deal status after payment: {deal['status']}")

        # Step 6: Release from hold (if in hold_period)
        if deal and deal.get("status") == "hold_period":
            result = self.release_from_hold(deal_id)
            if not result:
                self.log("Flow failed at step 6: release", "ERROR")
                return False

        # Final check
        deal = self.get_deal(deal_id)
        if deal:
            self.log("=" * 60)
            self.log("FINAL DEAL STATE", "SUCCESS")
            self.log("=" * 60)
            self.log(f"  ID: {deal['id']}")
            self.log(f"  Status: {deal['status']}")
            self.log(f"  Payment URL: {deal.get('payment_link_url', 'N/A')}")

        self.log("=" * 60)
        self.log("Bank-split flow test completed!", "SUCCESS")
        self.log("=" * 60)
        return True


def main():
    parser = argparse.ArgumentParser(description="Test bank-split flow")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL of the API (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--token",
        help="JWT token for authentication",
    )
    parser.add_argument(
        "--step",
        choices=["create", "submit", "sign", "invoice", "pay", "release", "cancel", "full"],
        default="full",
        help="Which step to run (default: full flow)",
    )
    parser.add_argument(
        "--deal-id",
        help="Deal ID for specific step operations",
    )

    args = parser.parse_args()

    tester = BankSplitTester(args.base_url, args.token)

    if args.step == "full":
        success = tester.run_full_flow()
        sys.exit(0 if success else 1)
    elif args.step == "create":
        deal = tester.create_deal()
        if deal:
            print(f"\nDeal ID: {deal['id']}")
    elif args.step == "submit":
        if not args.deal_id:
            print("Error: --deal-id required for submit step")
            sys.exit(1)
        tester.submit_for_signing(args.deal_id)
    elif args.step == "sign":
        if not args.deal_id:
            print("Error: --deal-id required for sign step")
            sys.exit(1)
        tester.mark_signed(args.deal_id)
    elif args.step == "invoice":
        if not args.deal_id:
            print("Error: --deal-id required for invoice step")
            sys.exit(1)
        tester.create_invoice(args.deal_id)
    elif args.step == "pay":
        if not args.deal_id:
            print("Error: --deal-id required for pay step")
            sys.exit(1)
        tester.simulate_payment_webhook(args.deal_id)
    elif args.step == "release":
        if not args.deal_id:
            print("Error: --deal-id required for release step")
            sys.exit(1)
        tester.release_from_hold(args.deal_id)
    elif args.step == "cancel":
        if not args.deal_id:
            print("Error: --deal-id required for cancel step")
            sys.exit(1)
        tester.cancel_deal(args.deal_id)


if __name__ == "__main__":
    main()
