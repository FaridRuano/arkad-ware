import crypto from "crypto";
import PasswordActionToken from "@models/PasswordActionToken";

export function generateRawToken() {
    return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function createPasswordActionToken({
    userId,
    purpose,
    expiresInMinutes = 20,
    requestedIp = null,
    requestedUserAgent = null,
    requestedCity = null,
    requestedLatitude = null,
    requestedLongitude = null,
}) {
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await PasswordActionToken.updateMany(
        {
            userId,
            purpose,
            usedAt: null,
            expiresAt: { $gt: new Date() },
        },
        {
            $set: {
                expiresAt: new Date(),
            },
        }
    );

    await PasswordActionToken.create({
        userId,
        tokenHash,
        purpose,
        expiresAt,
        requestedIp,
        requestedUserAgent,
        requestedCity,
        requestedLatitude,
        requestedLongitude,
    });

    return {
        rawToken,
        expiresAt,
    };
}

export async function findValidPasswordActionToken({
    rawToken,
    purpose,
}) {
    const tokenHash = hashToken(rawToken);

    return PasswordActionToken.findOne({
        tokenHash,
        purpose,
        usedAt: null,
        expiresAt: { $gt: new Date() },
    });
}

export async function consumePasswordActionToken({
    rawToken,
    purpose,
}) {
    const tokenHash = hashToken(rawToken);

    const tokenDoc = await PasswordActionToken.findOne({
        tokenHash,
        purpose,
        usedAt: null,
        expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) return null;

    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    return tokenDoc;
}