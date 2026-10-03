export async function onRequest(context) {
    // گرفتن فایل view.html از asset ها و برگردوندنش
    const url = new URL(context.request.url);
    url.pathname = '/view.html';
    return context.env.ASSETS.fetch(new Request(url, context.request));
}