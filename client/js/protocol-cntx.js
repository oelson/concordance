/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la gestion du protocole applicatif (recherche contextuelle).
 * 
 * Copyright 2013 Houillon Nelson <houillon.nelson@gmail.com>
 * 
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 *  MA 02110-1301, USA.
 */

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

/*
 * Ajoute un nom de livre à la fin de la section de lecture.
   TODO Il faut afficher les psaumes et les proverbes différement
 */

function addBookToContextList(bookName)
{
    var h1 = document.createElement("h1");
    h1.appendChild(document.createTextNode(bookName));
    contextContainerSection.appendChild(h1);
}

/*
 * Ajoute un numéro de chapitre à la fin de la section de lecture.
 */

function addChapterToContextList(chapter)
{
    var h2 = document.createElement("h2");
    h2.appendChild(document.createTextNode(chapter));
    contextContainerSection.appendChild(h2);
}

/*
 * Ajoute un verset à la lecture contextuelle (panneau du bas).
 */

function addVerseToContextList(book, chapter, verse, text)
{
    // sauvegarde indépendante du DOM
    contextVerseList[verse] = text;
    var span = document.createElement("span");
    span.appendChild(document.createTextNode(" "+verse+" "));
    var q = document.createElement("blockquote");
    // Met en surbrillance le verset clé
    var textNode = document.createTextNode(text);
    if (lastContextualQueryReference.book == book &&
        lastContextualQueryReference.chapterRange["low"] == chapter &&
        lastContextualQueryReference.verseRange["low"] == verse)
    {
        var mark = document.createElement("mark");
        mark.appendChild(textNode);
        textNode = mark;
        // Sauve la référence sur le noeud pour pouvoir l'afficher à la fin
        lastContextualQueryBlockQuote = q;
    }
    q.appendChild(span);
    q.appendChild(textNode);
    // Sélection d'une partie de texte à la souris
    q.addEventListener("mouseup", function() {
        var selectionObj = window.getSelection();
        var word = getSelectedWord(selectionObj);
        if (word) {
            showArrowBox(selectionObj, word);
        } else {
            hideArrowBox();
        }
    }, false);
    contextContainerSection.appendChild(q);
}

/*
 * Vide le panneau de lecture contextuelle.
 */

function cleanContextList()
{
    contextVerseList = {};
    while (contextContainerSection.childElementCount > 0) {
        contextContainerSection.removeChild(contextContainerSection.firstElementChild);
    }
}

/*
 * Vérifie la sélection courante pour voir si un mot est surligné.
 */

function getSelectedWord(selectionObj)
{
    if (!selectionObj || selectionObj.type != "Range") return;
    // Extrait le texte précédent et suivant la sélection
    var l = Math.min(selectionObj.anchorOffset, selectionObj.focusOffset),
        r = Math.max(selectionObj.anchorOffset, selectionObj.focusOffset);
    var textBefore = selectionObj.focusNode.textContent.slice(0, l);
    var textAfter  = selectionObj.focusNode.textContent.slice(r);
    // Le texte précédent doit soit être nul, soit ne pas terminer par une
    // lettre. De même pour le texte suivant.
    if ((!textBefore || !endWithALetterRegex.test(textBefore)) 
    && (!textAfter || !startsWithALetterRegex.test(textAfter)))
    {
        // Vérifie que le texte sélectionné est bien un mot
        var t = selectionObj.toString();
        // Enlève éventuellement la particule précédent le mot
        t = t.replace(/^[a-zA-Z]'/, "");
        if (isAWordReqex.test(t)) {
            return t;
        }
    }
}

/*
 * Affiche la boîte de dialogue fléchée sous la sélection.
 */

function showArrowBox(selectionObj, word)
{
    arrowBoxSection.classList.add("hidden");
    var x, y, w;
    // Obtient les coordonnées de la sélection
    var r = selectionObj.getRangeAt(0);
    var rect = r.getClientRects()[0];
    x = rect.left;
    y = rect.top;
    // Place la boîte soit au dessus du morceau de texte
    y -= arrowBoxSection.offsetHeight;
    // Déplace la boîte pour que la flèche soit alignée à gauche
    x -= arrowBoxSection.offsetWidth / 2;
    // Mesure le mot surligné
    var textEl = document.createTextNode(word);
    measureBlockQuote.appendChild(textEl);
    w = measureBlockQuote.offsetWidth;
    measureBlockQuote.removeChild(textEl);
    // Déplace la flèche au milieu du mot
    x += w / 2;
    // Rend la position relative à la section de contexte
    var coor = contextSection.getAbsoluteCoordinates();
    x -= coor["x"];
    y -= coor["y"];
    // Tient compte du défilement
    x += contextSection.scrollLeft;
    y += contextSection.scrollTop;
    // CSS
    arrowBoxSection.style.left = x+"px";
    arrowBoxSection.style.top  = y+"px";
    arrowBoxSection.classList.remove("hidden");
    // Sauve le mot à chercher dans le bouton
    getDefinitionButton.word = word;
}

/*
 * Cache la boîte de dialogue fléchée.
 */

function hideArrowBox()
{
    arrowBoxSection.classList.add("hidden");
}
