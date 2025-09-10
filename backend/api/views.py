from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics, permissions
from .serializers import UserSerializer, ProfileSerializer
from .models import Profile
from rest_framework.permissions import IsAuthenticated, AllowAny



class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]  # Allow anyone to create an account

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