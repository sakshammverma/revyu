"""Email copy for the six v1 templates (SRS-13.2). Plain, short, one action
per documents/09-DESIGN-BRIEF.md §7 voice guidance for WhatsApp/notifications.
"""


def render(template: str, data: dict) -> tuple[str, str]:
    """Returns (subject, plain-text body)."""
    if template == "otp_login":
        return (
            "Your Revyu login code",
            f"Your code is {data['code']}. It expires in 10 minutes.\n\n"
            f"Or tap this link to log in directly: {data['magic_link']}",
        )
    if template == "outlet_activated":
        return (
            "Your Revyu QR is ready",
            f"{data['business_name']} is verified and live.\n\n"
            f"Your QR code and print files (receipt footer, handout card, counter "
            f"standee, counter sticker) are in your dashboard: {data['dashboard_url']}\n"
            f"Log in with this email address — we'll send you a one-time code.\n\n"
            f"Your review link: {data['short_url']}\n\n"
            f"Print the receipt footer or hand out the cards. Keep the wording as it "
            f"is — \"scan to share your experience\" — and never offer anything in "
            f"return for a review.",
        )
    if template == "needs_info":
        return (
            "We need one more detail for your Revyu signup",
            f"Thanks for signing up {data['business_name']}. Before we can switch "
            f"your QR on, we need a little more information:\n\n{data['message']}\n\n"
            f"Just reply to this email. Your signup stays in the queue meanwhile.",
        )
    if template == "signup_rejected":
        return (
            "About your Revyu signup",
            f"We couldn't verify {data['business_name']}: {data['reason']}\n\n"
            f"{data['refund_line']}\n\nIf you think this is a mistake, reply to this email.",
        )
    if template == "first_scan":
        return (
            "First scan on your Revyu QR",
            f"{data['business_name']} just got its first scan. Check your "
            f"dashboard for the details.",
        )
    if template == "trial_threshold":
        return (
            "Your Revyu trial numbers are in",
            f"{data['business_name']}: {data.get('scans', 0)} scans, "
            f"{data.get('completed', 0)} completed reviews so far. Your QR "
            f"keeps working — pay now to unlock your full dashboard: "
            f"{data['payment_link']}",
        )
    if template == "private_feedback_received":
        return (
            "New private feedback on Revyu",
            f"A customer left private feedback for {data['business_name']}. "
            f"Rating: {data.get('rating', 'n/a')}. View it in your dashboard.",
        )
    if template == "weekly_digest":
        return (
            "Your weekly Revyu numbers",
            f"{data['business_name']} this week: {data.get('scans', 0)} scans, "
            f"{data.get('completed', 0)} completed, rating "
            f"{data.get('rating', 'n/a')}."
            + (f"\n\nCompetitor watch: {data['competitor_line']}" if data.get("competitor_line") else ""),
        )
    if template == "payment_failed":
        return (
            "Action needed: Revyu payment failed",
            f"Your payment for {data['business_name']} didn't go through. "
            f"You have {data.get('grace_days', 7)} days before collection "
            f"pauses. Update your payment method: {data.get('payment_link', '')}",
        )
    if template == "trial_reminder":
        return (
            f"{data['days_left']} days left in your Revyu trial",
            f"{data['business_name']}: {data.get('scans', 0)} scans and {data.get('completed', 0)} completed "
            "reviews so far. Your QR code never changes. Choose a plan any time to keep "
            f"everything running: {data['payment_link']}",
        )
    if template == "credits_low":
        return (
            "Only a few Revyu reviews left before collection pauses",
            f"{data['business_name']} can collect {data['credits_left']} more reviews before the QR "
            f"shows a neutral page. Unlock now to keep collecting: {data['payment_link']}",
        )
    if template == "collection_paused":
        return (
            "Your Revyu QR has paused",
            f"{data['business_name']} has used its trial reviews, so customers now see a neutral page. "
            "Pay to switch collection back on instantly, with the same QR code and all your data: "
            f"{data['payment_link']}",
        )
    if template == "zero_scan_nudge":
        return (
            "No scans yet on your Revyu QR",
            f"{data['business_name']} has had no scans in its first week. That usually means the QR "
            "is not where customers can see it. Try the payment counter, the receipt footer, or hand the "
            "card over with the bill. Need a hand? Just reply."
        )
    if template == "gap_report":
        return (
            f"Your Google review gap report - {data['business_name']}",
            f"{data['headline']}\n\n"
            f"Nearby, the strongest are:\n{data['competitor_lines']}\n\n"
            "Revyu puts a QR on your receipt so every happy customer can write a Google "
            "review in their own words. No outcome is promised - more reviews depend on "
            "how many customers scan."+"\n\n"
            f"Start your free trial: {data['signup_url']}",
        )
    if template == "service_update":
        return (
            f"Update on your {data['service_name']} request",
            f"{data['message']}\n\nOpen your dashboard to see details or reply: {data['dashboard_url']}",
        )
    raise ValueError(f"Unknown template: {template}")
