from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Profile, FriendRequest, Message
from .serializers import MessageSerializer
import django.db.models as models
import json
from django.utils import timezone
from urllib.parse import parse_qs


class FriendConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get user_id from query string
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        user_id = query_params.get('user_id', [None])[0]

        self.user = None
        if user_id:
            try:
                self.user = await database_sync_to_async(User.objects.get)(id=user_id)
            except User.DoesNotExist:
                print(f"User with id {user_id} not found")

        print(f"WebSocket connect attempt by user: {self.user}, user_id: {user_id}")

        # Always join a group (even anonymous gets a placeholder group)
        self.group_name = f"user_{self.user.id if self.user else 'anonymous'}"
        print(f"Joining group: {self.group_name}")
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        if self.user:
            await self.update_online_status(True)
            await self.notify_friends_status(True)

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "user") and self.user:
            print(f"WebSocket disconnected for user: {self.user}, close_code: {close_code}")
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            await self.update_online_status(False)
            await self.notify_friends_status(False)

    async def receive(self, text_data):
        data = json.loads(text_data)
        print("WS received:", data)

        if data.get("event") == "send_message":
            receiver_id = data.get("receiver_id")
            content = data.get("content")
            if not receiver_id or not content:
                return

            # Save to DB
            message = await self.save_message(receiver_id, content)
            serialized = MessageSerializer(message).data

            # Broadcast to receiver group
            await self.channel_layer.group_send(
                f"user_{receiver_id}",
                {
                    "type": "chat_message",
                    "message": serialized
                }
            )

            # Broadcast to sender group too
            await self.channel_layer.group_send(
                f"user_{self.user.id}",
                {
                    "type": "chat_message",
                    "message": serialized
                }
            )
        
        elif data.get("event") == "typing":
            receiver_id = data.get("receiver_id")
            is_typing = data.get("is_typing", False)

            if receiver_id:
                # Send typing event to receiver
                await self.channel_layer.group_send(
                    f"user_{receiver_id}",
                    {
                        "type": "typing_indicator",
                        "user_id": self.user.id,
                        "username": self.user.username,
                        "is_typing": is_typing
                    }
                )

    # Generic chat message handler (same for sender + receiver)
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "event": "new_message",
            "message": event["message"]
        }))

    async def typing_indicator(self, event):
        await self.send(text_data=json.dumps({
            "event": "typing_indicator",
            "user_id": event["user_id"],
            "username": event["username"],
            "is_typing": event["is_typing"],
        }))

    async def friend_request(self, event):
        await self.send(text_data=json.dumps({
            "event": "friend_request",
            "from_user": event["from_user"],
            "request_id": event["request_id"]
        }))

    async def friend_request_accepted(self, event):
        await self.send(text_data=json.dumps({
            "event": "friend_request_accepted",
            "from_user": event["from_user"],
            "to_user": event["to_user"],
            "request_id": event["request_id"]
        }))

    async def online_status(self, event):
        await self.send(text_data=json.dumps({
            "event": "online_status",
            "user_id": event["user_id"],
            "username": event["username"],
            "is_online": event["is_online"]
        }))

    @database_sync_to_async
    def update_online_status(self, is_online):
        if not self.user:
            return
        try:
            profile = Profile.objects.get(user=self.user)
            profile.is_online = is_online
            profile.last_seen = timezone.now()
            profile.save()
        except Profile.DoesNotExist:
            print(f"Profile not found for user: {self.user}")

    @database_sync_to_async
    def get_friends(self):
        if not self.user:
            return []
        friend_requests = FriendRequest.objects.filter(
            status="accepted"
        ).filter(models.Q(from_user=self.user) | models.Q(to_user=self.user))
        friends = []
        for req in friend_requests:
            if req.from_user == self.user:
                friends.append(req.to_user)
            else:
                friends.append(req.from_user)
        return friends

    async def notify_friends_status(self, is_online):
        if not self.user:
            return
        friends = await self.get_friends()
        for friend in friends:
            await self.channel_layer.group_send(
                f"user_{friend.id}",
                {
                    "type": "online_status",
                    "user_id": self.user.id,
                    "username": self.user.username,
                    "is_online": is_online
                }
            )

    @database_sync_to_async
    def save_message(self, receiver_id, content):
        receiver = User.objects.get(id=receiver_id)
        return Message.objects.create(sender=self.user, receiver=receiver, content=content)
