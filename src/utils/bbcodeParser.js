// This function converts simple BBCode tags to HTML
export const parseBBCode = (text) => {
    if (!text) return '';

    let html = text;

    // #comment escape HTML to prevent XSS
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // #comment convert newlines to <br> tags
    html = html.replace(/\n/g, '<br />');

    // [b]bold[/b]
    html = html.replace(/\[b\](.*?)\[\/b\]/gs, '<strong>$1</strong>');

    // [i]italic[/i]
    html = html.replace(/\[i\](.*?)\[\/i\]/gs, '<em>$1</em>');

    // [u]underline[/u]
    html = html.replace(/\[u\](.*?)\[\/u\]/gs, '<u>$1</u>');

    // [color=red]red text[/color]
    html = html.replace(/\[color=(.*?)\](.*?)\[\/color\]/gs, '<span style="color: $1;">$2</span>');

    // [size=18]sized text[/size]
    html = html.replace(/\[size=(.*?)\](.*?)\[\/size\]/gs, '<span style="font-size: $1px;">$2</span>');

    // [quote]quoted text[/quote]
    html = html.replace(/\[quote\](.*?)\[\/quote\]/gs, '<blockquote class="bbcode-quote">$1</blockquote>');

    // [player]playername[/player]
    html = html.replace(/\[player\](.*?)\[\/player\]/gs, '<span class="bbcode-player">$1</span>');

    return html;
};
