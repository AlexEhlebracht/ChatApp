from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Profile

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    # Custom username validation
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    # Custom password validation using Django’s built-in validators
    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            # Convert Django’s list of errors into DRF-friendly format
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user



class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Profile
        fields = ['id', 'username', 'first_name', 'last_name', 'profile_picture']

    def create(self, validated_data):
        # user must be passed in context
        user = self.context['user']
        profile = Profile.objects.create(user=user, **validated_data)
        return profile