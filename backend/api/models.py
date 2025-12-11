from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid
import os


def profile_pic_upload_to(instance, filename):
    # Get the file extension
    ext = filename.split('.')[-1]
    # Generate a new unique filename
    filename = f"{uuid.uuid4()}.{ext}"
    # Save it in the profile_pics folder
    return os.path.join('profile_pics', filename)

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    profile_picture = models.ImageField(upload_to=profile_pic_upload_to, blank=True, null=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.user.username}'s profile"


class FriendRequest(models.Model):
    from_user = models.ForeignKey(User, related_name="sent_friend_requests", on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name="received_friend_requests", on_delete=models.CASCADE)
    status = models.CharField(
        max_length=10,
        choices=[("pending", "Pending"), ("accepted", "Accepted"), ("rejected", "Rejected")],
        default="pending"
    )
    from_new_message = models.BooleanField(default=False)
    to_new_message = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("from_user", "to_user")

    def __str__(self):
        return f"{self.from_user} → {self.to_user} ({self.status})"

    
class Message(models.Model):
    sender = models.ForeignKey(User, related_name="sent_messages", on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name="received_messages", on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"{self.sender.username} → {self.receiver.username}: {self.content[:30]}"
