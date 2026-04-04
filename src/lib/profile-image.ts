type UserWithStoredProfileImage = {
  profileImage: string | null;
  customProfileImageUrl?: string | null;
};

export function resolveProfileImage(user: UserWithStoredProfileImage | null | undefined) {
  return user?.customProfileImageUrl ?? user?.profileImage ?? null;
}

export function withResolvedProfileImage<T extends UserWithStoredProfileImage>(user: T) {
  return {
    ...user,
    kakaoProfileImage: user.profileImage,
    profileImage: resolveProfileImage(user),
  };
}
