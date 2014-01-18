
/*
 * Procède à une demande de versets basée sur le contexte.
 */
 
function requestServerForContext(ref)
{
    if (!s) return;
    // Sauve la référence pour pouvoir mettre en surbrillance son texte après
    var r = new Reference(ref);
    r.parse();
    lastContextualQueryReference = r;
    var dict = {
        "now": new Date().getTime(),
        "ref": ref,
        "tok": "context",
        "tra": lastTranslationUsed
    };
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}

/*
 * Fonction de manipulation des réponses du serveur concernant les demandes de
 * contexte.
 */

function handleContextResponse(res)
{
    cleanContextList();
    var text;
    for (var bookName in res) {
        addBookToContextList(bookName);
        for (var chapter in res[bookName]) {
            addChapterToContextList(chapter);
            for (var verse in res[bookName][chapter]) {
                text = res[bookName][chapter][verse];
                addVerseToContextList(bookName, chapter, verse, text);
            }
        }
    }
    showContextTab();
    // à cet instant, cette variable désigne le noeud <blockquote> du verset
    // clé
    if (lastContextualQueryBlockQuote) {
        lastContextualQueryBlockQuote.scrollIntoView();
        lastContextualQueryBlockQuote = null;
    }
}
