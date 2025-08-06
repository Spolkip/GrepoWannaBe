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
    
    // [spoiler]spoiler text[/spoiler]
    html = html.replace(/\[spoiler\](.*?)\[\/spoiler\]/gs, '<details><summary>Spoiler</summary>$1</details>');

    // [player]playername[/player]
    html = html.replace(/\[player\](.*?)\[\/player\]/gs, '<span class="bbcode-player">$1</span>');
    
    // [alliance]alliance name[/alliance]
    html = html.replace(/\[alliance\](.*?)\[\/alliance\]/gs, '<span class="bbcode-alliance">$1</span>');

    // [city]city name[/city]
    html = html.replace(/\[city\](.*?)\[\/city\]/gs, '<span class="bbcode-city">$1</span>');

    // [island]island id[/island]
    html = html.replace(/\[island\](.*?)\[\/island\]/gs, '<span class="bbcode-island">Island $1</span>');
    
    // [img]image url[/img]
    html = html.replace(/\[img\](.*?)\[\/img\]/gs, '<img src="$1" alt="User Image" style="max-width: 100%;" />');
    
    // [url]url[/url] or [url=url]text[/url]
    html = html.replace(/\[url\](.*?)\[\/url\]/gs, '<a href="$1" target="_blank">$1</a>');
    html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gs, '<a href="$1" target="_blank">$2</a>');

    // [action=type,id=someId]Click Me[/action]
    html = html.replace(/\[action=([^,\]]+),allianceId=([^\]]+)\](.*?)\[\/action\]/gs, (match, type, id, text) => {
        return `<span class="bbcode-action" data-action-type="${type}" data-action-id="${id}">${text}</span>`;
    });
    
    // [report]reportId[/report] - This will now be a placeholder for React to render the component
    html = html.replace(/\[report\](.*?)\[\/report\]/gs, '<div class="shared-report-placeholder" data-report-id="$1"></div>');


    return html;
};
