export function getRequestIp(req) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
        return realIp.trim();
    }

    return null;
}

export function getRequestUserAgent(req) {
    return req.headers.get("user-agent") || null;
}