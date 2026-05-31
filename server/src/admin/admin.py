from sqladmin import Admin
from sqladmin._menu import CategoryMenu, ViewMenu
from sqladmin.authentication import login_required
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

from src.admin.auth import AdminAuth
from src.admin.dashboard import DashboardAdminView
from src.admin.views import (
    AssetAdminView,
    AssetVariantAdminView,
    CommentAdminView,
    CommentReactionAdminView,
    ContentAdminView,
    ContentAssetAdminView,
    ContentReactionAdminView,
    ContentTagAdminView,
    SessionAdminView,
    SubscriptionAdminView,
    TagAdminView,
    UserAdminView,
)
from src.common.database import async_engine
from src.config import settings


class OperationalAdmin(Admin):
    def _build_menu(self, view):  # type: ignore[no-untyped-def]
        if view.category:
            category_icon = getattr(view, "category_icon", None)
            menu = CategoryMenu(name=view.category, icon=category_icon)
            menu.add_child(ViewMenu(view=view, name=view.name, icon=view.icon))
            self._menu.add(menu)
            return

        self._menu.add(ViewMenu(view=view, icon=view.icon, name=view.name))

    @login_required
    async def index(self, request: Request) -> Response:
        return RedirectResponse(request.url_for("admin:dashboard"), status_code=302)


def create_admin(app) -> Admin:
    admin = OperationalAdmin(
        app=app,
        engine=async_engine,
        authentication_backend=AdminAuth(secret_key=settings.admin.secret_key),
        title="ELESEI Admin",
    )

    admin.add_base_view(DashboardAdminView)

    admin.add_model_view(UserAdminView)
    admin.add_model_view(SubscriptionAdminView)

    admin.add_model_view(ContentAdminView)
    admin.add_model_view(TagAdminView)
    admin.add_model_view(ContentTagAdminView)

    admin.add_model_view(CommentAdminView)
    admin.add_model_view(CommentReactionAdminView)
    admin.add_model_view(ContentReactionAdminView)

    admin.add_model_view(AssetAdminView)
    admin.add_model_view(AssetVariantAdminView)
    admin.add_model_view(ContentAssetAdminView)

    admin.add_model_view(SessionAdminView)

    # Messenger/chat entities are intentionally not exposed in the operational admin.

    return admin
