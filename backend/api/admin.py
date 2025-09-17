from django.contrib import admin
from django.utils.html import mark_safe
from .models import Profile, FriendRequest, Message

class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'first_name', 'last_name', 'profile_image_preview')
    readonly_fields = ('profile_image_preview',)

    def profile_image_preview(self, obj):
        if obj.profile_picture:
            return mark_safe(
                f'<img src="{obj.profile_picture.url}" width="50" height="50" style="object-fit: cover; border-radius: 50%;" />'
            )
        return "No Image"
    
    profile_image_preview.short_description = "Profile Picture"

admin.site.register(Profile, ProfileAdmin)
admin.site.register(FriendRequest)
admin.site.register(Message)
