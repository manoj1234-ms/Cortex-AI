import proxy from "express-http-proxy"

export const proxyWithHeader = (serviceUrl, options = {}) => {
    return proxy(serviceUrl, {
        timeout: 120000,
        ...options,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            if (srcReq.user) {
                proxyReqOpts.headers["x-user-id"] = srcReq.user.userId
            }
            return proxyReqOpts
        },
        proxyErrorHandler: (err, res, next) => {
            console.error(`Proxy error to ${serviceUrl}:`, err.message || err);
            if (!res.headersSent) {
                res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URL);
                res.header("Access-Control-Allow-Credentials", "true");
                return res.status(504).json({
                    message: "The AI agent took too long to respond. Please try again with a shorter prompt or simpler request."
                });
            }
            return next(err);
        }
    })
}
