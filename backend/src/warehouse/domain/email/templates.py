"""Email HTML templates with multi-language support."""

# Email translations
TRANSLATIONS = {
    "en": {
        "password_reset": {
            "title": "Reset Your Password",
            "intro": "You requested a password reset for your Home Warehouse System account.",
            "expires": "Click the button below to reset your password. This link expires in 1 hour.",
            "button": "Reset Password",
            "ignore": "If you didn't request this, you can safely ignore this email.",
        },
        "loan_reminder": {
            "title": "Loan Reminder",
            "greeting": "Hi {name},",
            "overdue": "is overdue",
            "due_soon": "is due soon",
            "reminder": "This is a reminder that the following item",
            "due_date": "Due date: {date}",
            "return": "Please return the item at your earliest convenience.",
        },
        "workspace_invite": {
            "title": "You're Invited!",
            "invite": "{inviter} has invited you to join {workspace} as {role}.",
            "button": "Go to Dashboard",
            "login": "Log in to your account to access the workspace.",
        },
    },
    "et": {
        "password_reset": {
            "title": "Lähtesta oma parool",
            "intro": "Sa taotlesid parooli lähtestamist Home Warehouse System kontole.",
            "expires": "Klõpsa alloleval nupul oma parooli lähtestamiseks. See link aegub 1 tunni pärast.",
            "button": "Lähtesta parool",
            "ignore": "Kui sa seda ei taotlenud, võid seda e-kirja ignoreerida.",
        },
        "loan_reminder": {
            "title": "Laenutuse meeldetuletus",
            "greeting": "Tere {name},",
            "overdue": "on hilinenud",
            "due_soon": "tähtaeg on varsti",
            "reminder": "See on meeldetuletus, et järgmine ese",
            "due_date": "Tähtaeg: {date}",
            "return": "Palun tagasta ese esimesel võimalusel.",
        },
        "workspace_invite": {
            "title": "Sind on kutsutud!",
            "invite": "{inviter} kutsus sind liituma töörühma {workspace} rolliga {role}.",
            "button": "Mine juhtpaneelile",
            "login": "Logi sisse, et pääseda töörühmale juurde.",
        },
    },
    "ru": {
        "password_reset": {
            "title": "Сбросить пароль",
            "intro": "Вы запросили сброс пароля для вашей учётной записи Home Warehouse System.",
            "expires": "Нажмите на кнопку ниже, чтобы сбросить пароль. Ссылка действительна 1 час.",
            "button": "Сбросить пароль",
            "ignore": "Если вы не запрашивали сброс, просто проигнорируйте это письмо.",
        },
        "loan_reminder": {
            "title": "Напоминание о займе",
            "greeting": "Привет {name},",
            "overdue": "просрочен",
            "due_soon": "скоро истекает срок",
            "reminder": "Это напоминание о том, что следующий предмет",
            "due_date": "Срок возврата: {date}",
            "return": "Пожалуйста, верните предмет при первой возможности.",
        },
        "workspace_invite": {
            "title": "Вас пригласили!",
            "invite": "{inviter} пригласил вас присоединиться к {workspace} с ролью {role}.",
            "button": "Перейти в панель",
            "login": "Войдите в аккаунт, чтобы получить доступ к рабочему пространству.",
        },
    },
}


def get_translations(language: str, template_name: str) -> dict:
    """Get translations for a specific language and template."""
    lang = language if language in TRANSLATIONS else "en"
    return TRANSLATIONS[lang].get(template_name, TRANSLATIONS["en"][template_name])


def password_reset_template(reset_url: str, language: str = "en") -> str:
    """Generate password reset email HTML."""
    t = get_translations(language, "password_reset")
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a1a;">{t["title"]}</h1>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        {t["intro"]}
    </p>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        {t["expires"]}
    </p>
    <a href="{reset_url}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500;">
        {t["button"]}
    </a>
    <p style="color: #666; font-size: 14px;">
        {t["ignore"]}
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">
        Home Warehouse System
    </p>
</body>
</html>
"""


def loan_reminder_template(
    borrower_name: str,
    item_name: str,
    due_date: str,
    is_overdue: bool,
    language: str = "en",
) -> str:
    """Generate loan reminder email HTML."""
    t = get_translations(language, "loan_reminder")
    status_text = t["overdue"] if is_overdue else t["due_soon"]
    status_color = "#dc2626" if is_overdue else "#f59e0b"

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a1a;">{t["title"]}</h1>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        {t["greeting"].format(name=borrower_name)}
    </p>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        {t["reminder"]} <strong style="color: {status_color};">{status_text}</strong>:
    </p>
    <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <strong style="font-size: 18px; color: #1a1a1a;">{item_name}</strong><br>
        <span style="color: #666;">{t["due_date"].format(date=due_date)}</span>
    </div>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        {t["return"]}
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">
        Home Warehouse System
    </p>
</body>
</html>
"""


def workspace_invite_template(
    inviter_name: str,
    workspace_name: str,
    role: str,
    app_url: str,
    language: str = "en",
) -> str:
    """Generate workspace invitation email HTML."""
    t = get_translations(language, "workspace_invite")
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a1a;">{t["title"]}</h1>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        {t["invite"].format(inviter=inviter_name, workspace=workspace_name, role=role)}
    </p>
    <a href="{app_url}/dashboard" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500;">
        {t["button"]}
    </a>
    <p style="color: #666; font-size: 14px;">
        {t["login"]}
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">
        Home Warehouse System
    </p>
</body>
</html>
"""
