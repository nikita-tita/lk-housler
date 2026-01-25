"""Bank Split background tasks for T-Bank integration"""

import logging
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def check_hold_expiry(self):
    """
    Check for deals with expired hold period and release funds.
    Runs every 1 minute.

    Flow:
    1. Query deals in HOLD_PERIOD status where hold_expires_at < now()
    2. For each deal, call T-Bank API to release funds
    3. Update deal status to COMPLETED
    4. Send notifications to participants
    """
    import asyncio
    from app.db.session import async_session_maker
    from app.services.bank_split import BankSplitDealService

    logger.info("Starting hold expiry check")

    async def _check():
        async with async_session_maker() as db:
            service = BankSplitDealService(db)
            released = await service.check_expired_holds()
            await db.commit()
            return len(released)

    try:
        released_count = asyncio.get_event_loop().run_until_complete(_check())
        logger.info(f"Released {released_count} deals from hold")
        return {"status": "ok", "released": released_count, "checked_at": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        logger.error(f"Hold expiry check failed: {e}")
        return {"status": "error", "error": str(e), "checked_at": datetime.now(timezone.utc).isoformat()}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def reconcile_with_bank(self):
    """
    Reconcile local deal statuses with T-Bank actual state.
    Runs every 5 minutes.

    Flow:
    1. Query deals in pending states (PAYMENT_PENDING, HOLD_PERIOD)
    2. For each deal, fetch status from T-Bank API
    3. Update local status if bank status differs
    4. Log any discrepancies for investigation
    """
    logger.info("Starting T-Bank reconciliation")

    # TODO: Implement when TBank client is ready (E3)
    # from app.services.bank_split import BankSplitService
    # service = BankSplitService()
    # result = service.reconcile()
    # logger.info(f"Reconciliation complete: {result}")

    return {"status": "ok", "reconciled": 0, "checked_at": datetime.now(timezone.utc).isoformat()}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120)
def check_pending_webhooks(self):
    """
    Check for webhooks that were received but not fully processed.
    Runs every 2 minutes.

    Flow:
    1. Query bank_events with status PENDING older than 2 minutes
    2. Re-process each event
    3. Update event status
    """
    logger.info("Starting pending webhooks check")

    # TODO: Implement when bank_events model is ready (E2)
    # from app.services.tbank_webhook import TBankWebhookService
    # service = TBankWebhookService()
    # processed = service.retry_pending_events()
    # logger.info(f"Processed {processed} pending webhooks")

    return {"status": "ok", "processed": 0, "checked_at": datetime.now(timezone.utc).isoformat()}


@celery_app.task(bind=True, max_retries=5, default_retry_delay=60)
def process_payment_webhook(self, event_id: str, payload: dict):
    """
    Process a single payment webhook from T-Bank.
    Called when webhook is received.

    Args:
        event_id: UUID of the bank_event record
        payload: Webhook payload from T-Bank
    """
    logger.info(f"Processing payment webhook: {event_id}")

    # TODO: Implement when models and services are ready
    # from app.services.tbank_webhook import TBankWebhookService
    # service = TBankWebhookService()
    # service.process_event(event_id, payload)

    return {"status": "ok", "event_id": event_id}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def notify_deal_status_change_task(
    self,
    deal_id: str,
    old_status: str,
    new_status: str,
    phone: str = None,
    email: str = None,
    address: str = "",
    **kwargs,
):
    """
    Send notifications when deal status changes via SMS and Email.

    Args:
        deal_id: UUID of the deal
        old_status: Previous deal status
        new_status: New deal status
        phone: Phone number for SMS notifications (optional)
        email: Email address for email notifications (optional)
        address: Property address
        **kwargs: Additional data (client_name, agent_name, amount, etc.)
    """
    import asyncio
    from app.services.notification.service import notify_deal_status_change

    logger.info(f"Deal {deal_id} status changed: {old_status} -> {new_status}")

    async def _notify():
        return await notify_deal_status_change(
            deal_id=deal_id,
            old_status=old_status,
            new_status=new_status,
            phone=phone,
            email=email,
            address=address,
            **kwargs,
        )

    try:
        result = asyncio.get_event_loop().run_until_complete(_notify())
        logger.info(f"Notification result for deal {deal_id}: SMS={result.get('sms')}, Email={result.get('email')}")
        return {
            "status": "ok",
            "deal_id": deal_id,
            "transition": f"{old_status}->{new_status}",
            "sms_sent": result.get("sms", False),
            "email_sent": result.get("email", False),
        }
    except Exception as e:
        logger.error(f"Notification failed for deal {deal_id}: {e}")
        self.retry(exc=e)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def check_milestone_triggers(self):
    """
    TASK-2.4: Check milestones ready for automatic release.
    Runs every 5 minutes.

    Flow:
    1. Query deal_milestones in HOLD status where release_scheduled_at < now()
    2. For milestones with IMMEDIATE, SHORT_HOLD, or DATE triggers, process release
    3. Update milestone status to RELEASED
    4. Log results

    Note: CONFIRMATION milestones are not auto-released - they require manual confirmation.
    """
    import asyncio
    from app.db.session import async_session_maker
    from app.services.bank_split.milestone_service import MilestoneService

    logger.info("Starting milestone triggers check")

    async def _check():
        async with async_session_maker() as db:
            service = MilestoneService(db)
            results = await service.check_milestone_triggers()
            await db.commit()
            return results

    try:
        results = asyncio.get_event_loop().run_until_complete(_check())

        released_count = sum(1 for r in results if r.success)
        failed_count = sum(1 for r in results if not r.success)

        logger.info(
            f"Milestone triggers check complete: "
            f"{released_count} released, {failed_count} failed"
        )

        return {
            "status": "ok",
            "released": released_count,
            "failed": failed_count,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Milestone triggers check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_invitation_notification_task(
    self,
    phone: str = None,
    email: str = None,
    partner_name: str = "Партнёр",
    inviter_name: str = "Агент",
    address: str = "",
    split_percent: float = 0,
    invite_url: str = "",
):
    """
    Send invitation notification to partner via SMS and Email.
    """
    import asyncio
    from app.services.notification.service import notify_invitation

    logger.info(f"Sending invitation to {phone or email} for deal at {address}")

    async def _notify():
        return await notify_invitation(
            phone=phone,
            email=email,
            partner_name=partner_name,
            inviter_name=inviter_name,
            address=address,
            split_percent=split_percent,
            invite_url=invite_url,
        )

    try:
        result = asyncio.get_event_loop().run_until_complete(_notify())
        logger.info(f"Invitation notification result: SMS={result.get('sms')}, Email={result.get('email')}")
        return {
            "status": "ok",
            "sms_sent": result.get("sms", False),
            "email_sent": result.get("email", False),
        }
    except Exception as e:
        logger.error(f"Invitation notification failed: {e}")
        self.retry(exc=e)


# =============================================================================
# UC-3.2: Act signing tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_act_signing_reminder(self, deal_id: str, day: int):
    """
    UC-3.2: Send reminder to client to sign Act of Completed Services.

    Scheduled reminders:
    - Day 1: "Подпишите акт"
    - Day 3: "Напоминаем о подписании"
    - Day 5: "Осталось 2 дня"
    - Day 6: "Завтра auto-release"

    Args:
        deal_id: UUID of the deal
        day: Day number since confirmation was requested
    """
    import asyncio
    from uuid import UUID
    from app.db.session import async_session_maker
    from sqlalchemy import select
    from app.models.deal import Deal, DealStatus

    logger.info(f"Sending act signing reminder for deal {deal_id}, day {day}")

    reminder_messages = {
        1: "Подпишите акт выполненных работ по сделке. Ссылка для подписания в SMS.",
        3: "Напоминаем о подписании акта. Осталось 4 дня до автоматической выплаты.",
        5: "Осталось 2 дня для подписания акта или открытия спора.",
        6: "Завтра произойдёт автоматическая выплата. Подпишите акт сегодня.",
    }

    async def _send_reminder():
        async with async_session_maker() as db:
            # Get deal
            stmt = select(Deal).where(Deal.id == UUID(deal_id))
            result = await db.execute(stmt)
            deal = result.scalar_one_or_none()

            if not deal:
                logger.warning(f"Deal {deal_id} not found for reminder")
                return {"status": "not_found"}

            # Check if deal is still in AWAITING_CLIENT_CONFIRMATION
            if deal.status != DealStatus.AWAITING_CLIENT_CONFIRMATION.value:
                logger.info(
                    f"Deal {deal_id} no longer awaiting confirmation "
                    f"(status: {deal.status}), skipping reminder"
                )
                return {"status": "skipped", "reason": "status_changed"}

            # Check if act was already signed
            if deal.act_signed_at:
                logger.info(f"Deal {deal_id} act already signed, skipping reminder")
                return {"status": "skipped", "reason": "already_signed"}

            # Send SMS reminder
            from app.services.notification.service import send_sms_notification

            message = reminder_messages.get(day, reminder_messages[1])
            phone = deal.client_phone

            if phone:
                await send_sms_notification(
                    phone=phone,
                    message=message,
                )
                logger.info(f"Sent day {day} reminder for deal {deal_id} to {phone}")
                return {"status": "sent", "day": day}
            else:
                logger.warning(f"No phone for deal {deal_id}, cannot send reminder")
                return {"status": "no_phone"}

    try:
        result = asyncio.get_event_loop().run_until_complete(_send_reminder())
        return {
            "status": "ok",
            "deal_id": deal_id,
            "day": day,
            **result,
        }
    except Exception as e:
        logger.error(f"Failed to send act signing reminder for deal {deal_id}: {e}")
        self.retry(exc=e)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def check_act_signature_timeout(self, deal_id: str):
    """
    UC-3.2: Check if Act signature timeout has expired and auto-release funds.

    Called on day 7 after confirmation request.
    If act not signed and no dispute opened → auto-release to PAYOUT_READY.

    Args:
        deal_id: UUID of the deal to check
    """
    import asyncio
    from uuid import UUID
    from app.db.session import async_session_maker
    from sqlalchemy import select
    from app.models.deal import Deal, DealStatus

    logger.info(f"Checking act signature timeout for deal {deal_id}")

    async def _check_timeout():
        async with async_session_maker() as db:
            # Get deal
            stmt = select(Deal).where(Deal.id == UUID(deal_id))
            result = await db.execute(stmt)
            deal = result.scalar_one_or_none()

            if not deal:
                logger.warning(f"Deal {deal_id} not found for timeout check")
                return {"status": "not_found"}

            # Check if deal is still in AWAITING_CLIENT_CONFIRMATION
            if deal.status != DealStatus.AWAITING_CLIENT_CONFIRMATION.value:
                logger.info(
                    f"Deal {deal_id} no longer awaiting confirmation "
                    f"(status: {deal.status}), skipping auto-release"
                )
                return {"status": "skipped", "reason": "status_changed"}

            # Check if act was signed
            if deal.act_signed_at:
                logger.info(f"Deal {deal_id} act was signed, skipping auto-release")
                return {"status": "skipped", "reason": "already_signed"}

            # Check if dispute is open
            if deal.dispute_locked:
                logger.info(f"Deal {deal_id} has dispute, skipping auto-release")
                return {"status": "skipped", "reason": "dispute_open"}

            # Auto-release
            from app.services.bank_split.deal_service import BankSplitDealService

            deal_service = BankSplitDealService(db)
            await deal_service.auto_release_confirmation(deal)
            await db.commit()

            logger.info(f"Deal {deal_id} auto-released after confirmation timeout")

            # Send notification to client
            from app.services.notification.service import send_sms_notification

            if deal.client_phone:
                await send_sms_notification(
                    phone=deal.client_phone,
                    message="Акт выполненных работ принят автоматически. Выплата исполнителям будет произведена в ближайшее время.",
                )

            return {"status": "auto_released"}

    try:
        result = asyncio.get_event_loop().run_until_complete(_check_timeout())
        return {
            "status": "ok",
            "deal_id": deal_id,
            **result,
        }
    except Exception as e:
        logger.error(f"Failed to check act signature timeout for deal {deal_id}: {e}")
        self.retry(exc=e)


@celery_app.task(bind=True)
def check_expired_confirmations(self):
    """
    UC-3.2: Periodic check for deals with expired client confirmation deadline.
    Runs every hour as a backup to individual timeout tasks.

    This catches any deals where the scheduled check_act_signature_timeout task
    might have failed.
    """
    import asyncio
    from app.db.session import async_session_maker
    from app.services.bank_split.deal_service import BankSplitDealService

    logger.info("Starting periodic expired confirmations check")

    async def _check():
        async with async_session_maker() as db:
            service = BankSplitDealService(db)
            released = await service.check_expired_confirmations()
            await db.commit()
            return len(released)

    try:
        released_count = asyncio.get_event_loop().run_until_complete(_check())
        logger.info(f"Auto-released {released_count} deals from expired confirmation")
        return {
            "status": "ok",
            "released": released_count,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Expired confirmations check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
