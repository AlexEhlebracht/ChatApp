from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .serializers import UserSerializer, ProfileSerializer, FriendRequestSerializer, MessageSerializer
from .models import Profile, FriendRequest, Message
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.models import Value
from django.db.models.functions import Concat
from django.db.models import Q
from datetime import datetime, timezone as dt_timezone


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
        
        # Annotate full_name for searching
        profiles = Profile.objects.annotate(
            full_name=Concat('first_name', Value(' '), 'last_name')
        ).filter(
            full_name__icontains=query
        ).exclude(user=request.user)  # exclude self

        # Exclude users with pending or accepted friend requests
        existing_requests = FriendRequest.objects.filter(
            Q(from_user=request.user) | Q(to_user=request.user),
            status__in=["pending", "accepted"]
        )

        # Collect the IDs of users who already have a request/are friends
        excluded_user_ids = set()
        for req in existing_requests:
            if req.from_user == request.user:
                excluded_user_ids.add(req.to_user.id)
            else:
                excluded_user_ids.add(req.from_user.id)

        profiles = profiles.exclude(user__id__in=excluded_user_ids)

        return Response(ProfileSerializer(profiles, many=True).data)



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
class RejectFriendRequestView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FriendRequestSerializer
    queryset = FriendRequest.objects.all()

    def destroy(self, request, *args, **kwargs):
        friend_request = self.get_object()
        if friend_request.to_user != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        friend_request.delete()
        return Response({"message": "Friend request rejected and deleted."}, status=status.HTTP_204_NO_CONTENT)


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
    

class FriendsListWithMessagesView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Get all accepted friend requests
        sent = FriendRequest.objects.filter(
            from_user=user,
            status="accepted"
        ).select_related('to_user__profile')
        
        received = FriendRequest.objects.filter(
            to_user=user,
            status="accepted"
        ).select_related('from_user__profile')
        
        # Build a list of friends with new message flags and last message time
        friends_data = []
        
        # For requests we sent, check to_new_message
        for req in sent:
            friend_user = req.to_user
            # Get most recent message between user and this friend (both directions)
            last_message = Message.objects.filter(
                Q(sender=user, receiver=friend_user) | Q(sender=friend_user, receiver=user)
            ).order_by('-timestamp').first()
            
            friends_data.append({
                'profile': friend_user.profile,
                'has_new_message': req.to_new_message,
                'last_message_time': last_message.timestamp if last_message else None
            })
        
        # For requests we received, check from_new_message
        for req in received:
            friend_user = req.from_user
            # Get most recent message between user and this friend (both directions)
            last_message = Message.objects.filter(
                Q(sender=user, receiver=friend_user) | Q(sender=friend_user, receiver=user)
            ).order_by('-timestamp').first()
            
            friends_data.append({
                'profile': friend_user.profile,
                'has_new_message': req.from_new_message,
                'last_message_time': last_message.timestamp if last_message else None
            })
        
        # Sort by most recent message first (None values go to end)
        from datetime import datetime
        from django.utils import timezone
        friends_data.sort(key=lambda x: x['last_message_time'] or datetime.min.replace(tzinfo=dt_timezone.utc), reverse=True)
        
        # Store in request for use in serializer
        self.friends_data = friends_data
        
        # Return profiles in the sorted order
        profile_ids = [fd['profile'].id for fd in friends_data]
        
        # Preserve the order using django's Case/When
        from django.db.models import Case, When, IntegerField
        
        preserved_order = Case(
            *[When(id=id, then=pos) for pos, id in enumerate(profile_ids)],
            output_field=IntegerField()
        )
        
        return Profile.objects.filter(id__in=profile_ids).order_by(preserved_order)
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Create a mapping of profile_id to has_new_message
        message_map = {fd['profile'].id: fd['has_new_message'] 
                      for fd in self.friends_data}
        
        serializer = self.get_serializer(queryset, many=True)
        
        # Add has_new_message to each serialized profile
        response_data = []
        for profile_data in serializer.data:
            profile_id = profile_data['id']
            response_data.append({
                **profile_data,
                'has_new_message': message_map.get(profile_id, False)
            })
        
        return Response(response_data)
    

class ChangeNewMessageView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        friend_id = request.query_params.get('friend_id')
        
        if not friend_id:
            return Response({'error': 'friend_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        current_user = request.user
        
        # Find the FriendRequest between current user and friend
        # Check both directions since either could have sent the request
        friend_request = FriendRequest.objects.filter(
            from_user=friend_id,
            to_user=current_user,
            status='accepted'
        ).first()
        
        if friend_request:
            # They sent the request, so mark from_new_message as False
            friend_request.from_new_message = False
            friend_request.save()
        else:
            # We sent the request, so mark to_new_message as False
            friend_request = FriendRequest.objects.filter(
                from_user=current_user,
                to_user=friend_id,
                status='accepted'
            ).first()
            
            if friend_request:
                friend_request.to_new_message = False
                friend_request.save()
            else:
                return Response({'error': 'Friend request not found'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({'success': True}, status=status.HTTP_200_OK)
    
    
class ChangeNewMessageTrueView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        friend_id = request.query_params.get('friend_id')
        
        if not friend_id:
            return Response({'error': 'friend_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        current_user = request.user
        
        # Find the FriendRequest between current user and friend
        # Check both directions since either could have sent the request
        friend_request = FriendRequest.objects.filter(
            from_user=friend_id,
            to_user=current_user,
            status='accepted'
        ).first()
        
        if friend_request:
            # They sent the original request, so we mark to_new_message as True
            # (because WE are sending a message TO them)
            friend_request.to_new_message = True
            friend_request.save()
        else:
            # We sent the original request, so mark from_new_message as True
            # (because WE are sending a message FROM us)
            friend_request = FriendRequest.objects.filter(
                from_user=current_user,
                to_user=friend_id,
                status='accepted'
            ).first()
            
            if friend_request:
                friend_request.from_new_message = True
                friend_request.save()
            else:
                return Response({'error': 'Friend request not found'}, status=status.HTTP_404_NOT_FOUND)
            
        channel_layer = get_channel_layer()

        async_to_sync(channel_layer.group_send)(
            f"user_{friend_id}",
            {
                "type": "new_message_dot",
                "event": "new_message_dot"
            }
        )
        
        return Response({'success': True}, status=status.HTTP_200_OK)
    

class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        friend_id = self.kwargs["friend_id"]
        user = self.request.user
        return Message.objects.filter(
            (Q(sender=user) & Q(receiver_id=friend_id)) |
            (Q(sender_id=friend_id) & Q(receiver=user))
        ).order_by("timestamp")

class MessageCreateView(generics.CreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)

        # Notify both the sender and receiver via WebSocket
        channel_layer = get_channel_layer()

        # Send to the receiver (assuming the receiver's ID is in the message)
        receiver_id = message.receiver.id

        async_to_sync(channel_layer.group_send)(
            f"user_{receiver_id}",
            {
                "type": "chat_message",
                "message": MessageSerializer(message).data  # Serialize the message
            }
        )

        # Send to the sender (optional, if you want an acknowledgment)
        async_to_sync(channel_layer.group_send)(
            f"user_{message.sender.id}",
            {
                "type": "chat_message",
                "message": MessageSerializer(message).data
            }
        )