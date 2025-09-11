from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .serializers import UserSerializer, ProfileSerializer, FriendRequestSerializer
from .models import Profile, FriendRequest
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework_simplejwt.authentication import JWTAuthentication



class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]  # Allow anyone to create an account

class TestAuthView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        return Response({
            "user_id": request.user.id,
            "username": request.user.username
        })
    

class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.GET.get("q", "")
        if not query:
            return Response([], status=200)
        
        users = User.objects.filter(username__icontains=query).exclude(id=request.user.id)
        return Response(UserSerializer(users, many=True).data)
    

class ProfileView(generics.RetrieveUpdateAPIView):
    """
    GET/PUT the current user's profile
    """
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        # returns the profile of the currently authenticated user
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        return profile
    

# Send Friend Request
class SendFriendRequestView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def post(self, request, *args, **kwargs):
        to_username = request.data.get("to_username")
        try:
            to_user = User.objects.get(username=to_username)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user == to_user:
            return Response({"error": "Cannot send friend request to yourself"}, status=status.HTTP_400_BAD_REQUEST)

        if FriendRequest.objects.filter(from_user=request.user, to_user=to_user, status="pending").exists():
            return Response({"error": "Friend request already sent"}, status=status.HTTP_400_BAD_REQUEST)

        friend_request = FriendRequest.objects.create(from_user=request.user, to_user=to_user)

        # Send WebSocket notification to the recipient
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{to_user.id}",
            {
                "type": "friend_request",
                "from_user": request.user.username,
                "request_id": friend_request.id
            }
        )

        return Response(FriendRequestSerializer(friend_request).data, status=status.HTTP_201_CREATED)

# Accept Friend Request
class AcceptFriendRequestView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer
    queryset = FriendRequest.objects.all()

    def update(self, request, *args, **kwargs):
        friend_request = self.get_object()
        if friend_request.to_user != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        friend_request.status = "accepted"
        friend_request.save()

        # Send WebSocket notification to both users
        channel_layer = get_channel_layer()
        # Notify the acceptor (to_user)
        async_to_sync(channel_layer.group_send)(
            f"user_{friend_request.to_user.id}",
            {
                "type": "friend_request_accepted",
                "from_user": friend_request.from_user.username,
                "to_user": friend_request.to_user.username,
                "request_id": friend_request.id
            }
        )
        # Notify the sender (from_user)
        async_to_sync(channel_layer.group_send)(
            f"user_{friend_request.from_user.id}",
            {
                "type": "friend_request_accepted",
                "from_user": friend_request.from_user.username,
                "to_user": friend_request.to_user.username,
                "request_id": friend_request.id
            }
        )

        return Response(FriendRequestSerializer(friend_request).data, status=status.HTTP_200_OK)


# Reject Friend Request
class RejectFriendRequestView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer
    queryset = FriendRequest.objects.all()

    def update(self, request, *args, **kwargs):
        friend_request = self.get_object()
        if friend_request.to_user != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        friend_request.status = "rejected"
        friend_request.save()
        return Response(FriendRequestSerializer(friend_request).data)


# List Incoming Requests
class IncomingFriendRequestsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def get_queryset(self):
        return FriendRequest.objects.filter(to_user=self.request.user, status="pending")


# List Outgoing Requests
class OutgoingFriendRequestsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def get_queryset(self):
        return FriendRequest.objects.filter(from_user=self.request.user, status="pending")


# List Friends (accepted requests)
class FriendsListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileSerializer  # <-- use ProfileSerializer here

    def get_queryset(self):
        # all users who accepted or sent accepted requests
        sent = FriendRequest.objects.filter(
            from_user=self.request.user, status="accepted"
        ).values_list("to_user", flat=True)
        received = FriendRequest.objects.filter(
            to_user=self.request.user, status="accepted"
        ).values_list("from_user", flat=True)
        return Profile.objects.filter(user__id__in=list(sent) + list(received))