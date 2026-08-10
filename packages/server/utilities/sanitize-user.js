function toPublicUser(user) {
    if (!user) return user;
    const { passwordHash, ...safe } = user;
    return safe;
}

module.exports = { toPublicUser };
