"""Growth Services catalogue seed. Idempotent: existing keys are left alone so
admin edits are never overwritten. No prices: every service is quoted."""

from app.core.db import SessionLocal
from app.models.growth import ServiceCatalog

SERVICES = [
    {
        "key": "website",
        "name": "Website building",
        "tagline": "A fast, mobile-first website for your business.",
        "description_md": "We design and launch a simple website fed by the same details you already keep on your QR page: services, hours, links and location.",
        "deliverables": ["Up to 5 pages", "Mobile-first design", "Connected to your QR page details", "Hosting on your domain or ours"],
        "questions": [
            {"key": "domain", "label": "Do you already have a domain?", "type": "choice", "options": ["Yes", "No", "Not sure"]},
            {"key": "examples", "label": "Any websites you like?", "type": "text"},
        ],
        "lead_time_days": 14,
    },
    {
        "key": "landing_video",
        "name": "Landing video",
        "tagline": "One produced video for your website and social pages.",
        "description_md": "A short video that shows what makes your business worth a visit, made for your site and social profiles.",
        "deliverables": ["1 produced video", "Vertical and horizontal cuts", "Music and captions"],
        "questions": [
            {"key": "shoot", "label": "Shoot at your location?", "type": "choice", "options": ["Yes, on-site", "Use stock and photos", "Not sure"]},
            {"key": "goal", "label": "What should the video make people do?", "type": "text"},
        ],
        "lead_time_days": 10,
    },
    {
        "key": "content_pipeline",
        "name": "Content management pipeline",
        "tagline": "Planned, approved and scheduled social content.",
        "description_md": "We plan and produce your posts. You approve each one before anything is published.",
        "deliverables": ["Monthly content plan", "Posts produced for you", "Nothing goes live without your approval"],
        "questions": [
            {"key": "platforms", "label": "Which platforms?", "type": "text"},
            {"key": "frequency", "label": "How many posts a week?", "type": "choice", "options": ["1-2", "3-4", "5+"]},
        ],
        "lead_time_days": 7,
    },
    {
        "key": "instagram_automation",
        "name": "Instagram automation",
        "tagline": "Scheduled posts and auto-replies through the official Instagram API.",
        "description_md": "Set up scheduled publishing and reply rules on your business account using Instagram's official tools only.",
        "deliverables": ["Account connection", "Scheduled publishing", "Comment and message reply rules"],
        "questions": [
            {"key": "handle", "label": "Your Instagram handle", "type": "text"},
            {"key": "business_account", "label": "Is it a Business or Creator account?", "type": "choice", "options": ["Yes", "No", "Not sure"]},
        ],
        "lead_time_days": 10,
    },
    {
        "key": "whatsapp_automation",
        "name": "WhatsApp automation",
        "tagline": "Template messages to customers who have agreed to hear from you.",
        "description_md": "Official WhatsApp Business messaging to contacts who have opted in, with opt-out always honoured.",
        "deliverables": ["WhatsApp Business setup", "Approved message templates", "Opt-in and opt-out handling"],
        "questions": [
            {"key": "number", "label": "WhatsApp number to use", "type": "text"},
            {"key": "contacts", "label": "Do you hold customers' consent to message them?", "type": "choice", "options": ["Yes", "Some", "No"]},
        ],
        "lead_time_days": 21,
    },
]


def seed_service_catalog() -> None:
    db = SessionLocal()
    try:
        have = {k for (k,) in db.query(ServiceCatalog.key).all()}
        for i, s in enumerate(SERVICES):
            if s["key"] not in have:
                db.add(ServiceCatalog(sort_order=i, **s))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_service_catalog()
