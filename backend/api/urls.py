from django.urls import path
from .views import (
    ProfileView,
    SendFriendRequestView,
    AcceptFriendRequestView,
    RejectFriendRequestView,
    IncomingFriendRequestsView,
    OutgoingFriendRequestsView,
    FriendsListView,
    UserSearchView,
)

urlpatterns = [
    path('profile/', ProfileView.as_view(), name='user-profile'),
    path("users/search/", UserSearchView.as_view(), name="user-search"),
    path("friends/request/", SendFriendRequestView.as_view(), name="send-friend-request"),
    path("friends/accept/<int:pk>/", AcceptFriendRequestView.as_view(), name="accept-friend-request"),
    path("friends/reject/<int:pk>/", RejectFriendRequestView.as_view(), name="reject-friend-request"),
    path("friends/incoming/", IncomingFriendRequestsView.as_view(), name="incoming-friend-requests"),
    path("friends/outgoing/", OutgoingFriendRequestsView.as_view(), name="outgoing-friend-requests"),
    path("friends/", FriendsListView.as_view(), name="friends-list"),
]