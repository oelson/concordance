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

var compareTranslationCheckbox;
var contextSection;
var contextContainerSection;
var translationCompTable;
var referenceTranslationCell;
var compareTranslationCell;

/*
 * Manipulations DOM.
 */

document.addEventListener("DOMContentLoaded", function() {
    // case à cocher (dés)activant la comparaison de traductions
    compareTranslationCheckbox = document.getElementById("activer-comp-traduction");
    compareTranslationCheckbox.addEventListener("click", toggleTranslationCompare, false);
    // sélection de la traduction de comparaison
    optionForm.elements["traduction_comp"].addEventListener("change", cmpTranslationChange, false);
    // noeuds relatifs au contexte
    contextSection = document.getElementById("context");
    contextContainerSection = document.getElementById("context-container");
    translationCompTable = document.getElementById("translation-comparator");
    var cells = translationCompTable.getElementsByTagName("td");
    referenceTranslationCell = cells[0];
    compareTranslationCell = cells[1];
}, false);

// Traduction de comparaison (relativement à celle utilisée lors de la
// recherche). Si nulle, aucune comparaison n'est effectuée.
var compareTranslation = null;

// Liste de références (et leur texte) _actuellement_ affichées dans la zone
// de contexte.
var displayedContextList;

/*
 * Retourne vrai ou faux selon que le contexte d'un verset est déjà affiché ou
 * non.
 */

function isContextDisplayed()
{
    var i=0;
    for (var translation in displayedContextList) {
        ++i;
    }
    return i > 0;
}

/*
 * Met à jour la liste des traductions de comparaison en fonction de la
 * traduction actuellement sélectionnée.
 */

function updateAllowedCmpTranslations()
{
    // Grise les options non-valides
    var tr = filterForm.elements["traduction"].value;
    var opts = optionForm.elements["traduction_comp"].options;
    for (var i=0, opt; i < opts.length; ++i) {
        opt = opts[i];
        if (opt.value == tr) {
            opt.disabled = true;
            // L'option déjà sélectionnée est interdite
            if (optionForm.elements["traduction_comp"].value == tr) {
                if (i >= 1) {
                    // Sélectionne la précédente
                    optionForm.elements["traduction_comp"].value = opts[i-1].value;
                } else if (i <= opts.length-1) {
                    // Sélectionne la suivante
                    optionForm.elements["traduction_comp"].value = opts[i+1].value;
                }
            }
        } else {
            opt.disabled = false;
        }
    }
}

/*
 * (Dés)active la comparaison des traductions.
 */

function toggleTranslationCompare()
{
    if (this.checked) {
        enableTraCmpSelect();
        updateAllowedCmpTranslations();
        preSelectCmpTranslation();
        requestServerForMoreTranslation();
    } else {
        disableTraCmpSelect();
        hideCmpTranslation();
    }
}

/*
 * Pré-sélectionne la première traduction de comparaison autorisée.
 */

function preSelectCmpTranslation()
{
    var opts = optionForm.elements["traduction_comp"].options;
    for (var i=0, opt; i < opts.length; ++i) {
        opt = opts[i];
        if (!opt.disabled) {
            optionForm.elements["traduction_comp"].value = opt.value;
            compareTranslation = opt.value;
            break;
        }
    }
}

/*
 * Autorise la sélection d'une traduction de comparaison.
 */

function enableTraCmpSelect()
{
    optionForm.elements["traduction_comp"].disabled = false;
}


/*
 * Empêche de sélectionner une traduction de comparaison.
 */

function disableTraCmpSelect()
{
    optionForm.elements["traduction_comp"].disabled = true;
    compareTranslation = null;
}

/*
 * Sélectionne une autre traduction de comparaison.
 */

function cmpTranslationChange(e)
{
    compareTranslation = this.value;
}

/*
 * Parcours la liste des versets individuels pour bâtir une référence
 * "englobante".
 * Retourne une liste d'objets "Reference".
 */

function buildReferenceFromList(list)
{
    var refs = [], r;
    var verseLow, verseHgh;
    for (var translation in list) {
        for (var bookName in list[translation]) {
            for (var chapter in list[translation][bookName]) {
                // Construit l'intervalle des versets dans ce chapitre
                verseLow = 1;
                verseHgh = 1;
                for (var verse in list[translation][bookName][chapter]) {
                    if (verse < verseLow) {
                        verseLow = verse;
                    }
                    if (verse > verseHgh) {
                        verseHgh = verse;
                    }
                }
                r = new Reference();
                r.book = bookName;
                r.chapterRange["low"] = chapter;
                r.verseRange["low"] = verseLow;
                r.verseRange["high"] = verseHgh;
                refs.push(r.serialize());
            }
        }
        // Retourne la liste des versets de la première traduction uniquement
        return refs;
    }
}

/*
 * Procède à une demande de versets pour afficher une comparaison de
 * traductions.
 */

function requestServerForMoreTranslation()
{
    if (!s) {
        console.error("websocket not available");
        return;
    }
    if (!compareTranslation) {
        console.error("no comparison translation selected");
        return;
    }
    if (!isContextDisplayed()) {
        console.error("no context displayed");
        return;
    }
    if (!isContextDisplayed()) {
        console.error("no context displayed");
        return;
    }
    if (!lastContextualQueryReference) {
        console.error("no contextual reference selected");
        return;
    }
    var dict = {
        "now": new Date().getTime(),
        // utilise comme référence centrale celle qui avait été sélectionnée
        "ref": lastContextualQueryReference.serialize(),
        "tok": "context",
        // utilise la traduction alternative
        "tra": compareTranslation
    };
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}

/*
 * Procède à une demande de versets basée sur le contexte.
 */
 
function requestServerForContext(ref)
{
    if (!s) return;
    // Sauve la référence pour pouvoir mettre en surbrillance son texte
    var r = new Reference(ref);
    r.parse();
    lastContextualQueryReference = r;
    var dict = {
        "now": new Date().getTime(),
        "ref": ref,
        "tok": "context",
        "tra": lastTranslationUsed
    };
    // Ajoute en même temps une demande de comparaison de traduction
    if (compareTranslation) {
       dict["cmp"] = compareTranslation;
    }
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}

/*
 * Fonction de manipulation des réponses du serveur concernant les demandes de
 * contexte.
 * Les données sont structurées comme suit:
 *
 * + traduction
 * +--- livre
 * +------- chapitre
 * +----------- verset
 *
 */

function handleContextResponse(res)
{
    displayedContextList = {};
    var text;
    for (var translation in res) {
        if (translation == lastTranslationUsed) {
            referenceTranslationCell.clear();
        }
        if (translation == compareTranslation) {
            compareTranslationCell.clear();
        }
        for (var bookName in res[translation]) {
            addBookToContextList(translation, bookName);
            for (var chapter in res[translation][bookName]) {
                addChapterToContextList(translation, chapter);
                for (var verse in res[translation][bookName][chapter]) {
                    text = res[translation][bookName][chapter][verse];
                    addVerseToContextList(
                        translation,
                        bookName,
                        chapter,
                        verse,
                        text
                    );
                }
            }
        }
    }
    if (compareTranslation && compareTranslationCell.firstChild) {
        displayCmpTranslation();
    } else {
        hideCmpTranslation();
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
 * Retourne vrai ou faux selon que la traduction passée en argument est celle
 * qui est principalement utilisée (pour la recherche).
 */

function isReferenceTranslation(tr)
{
    return (tr == lastTranslationUsed);
}

/*
 * Ajoute un nom de livre à la fin de la section de lecture.
   TODO Il faut afficher les psaumes et les proverbes différement
 */

function addBookToContextList(translation, bookName)
{
    var h1 = document.createElement("h1");
    h1.appendChild(document.createTextNode(bookName));
    // Ajoute le chapitre à la cellule correspondant à la traduction initiale
    // ou de comparaison
    if (isReferenceTranslation(translation)) {
        referenceTranslationCell.appendChild(h1);
    } else {
        compareTranslationCell.appendChild(h1);
    }
}

/*
 * Ajoute un numéro de chapitre à la fin de la section de lecture.
 */

function addChapterToContextList(translation, chapter)
{
    var h2 = document.createElement("h2");
    h2.appendChild(document.createTextNode(chapter));
    // Ajoute le chapitre à la cellule correspondant à la traduction initiale
    // ou de comparaison
    if (isReferenceTranslation(translation)) {
        referenceTranslationCell.appendChild(h2);
    } else {
        compareTranslationCell.appendChild(h2);
    }
}

/*
 * Ajoute un verset à la lecture contextuelle (panneau du bas).
 */

function addVerseToContextList(translation, book, chapter, verse, text)
{
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
    q.addEventListener("mouseup", checkSelectedWord, false);
    // Ajoute le verset à la cellule correspondant à la traduction initiale ou
    // de comparaison
    if (translation == lastTranslationUsed) {
        referenceTranslationCell.appendChild(q);
    } else {
        compareTranslationCell.appendChild(q);
    }
    // Conserve une copie de la référence
    logContextualVerse(translation, book, chapter, verse, text);
}

/*
 * Conserve une copie du contexte affiché.
 */

function logContextualVerse(translation, book, chapter, verse, text)
{
    if (!(translation in displayedContextList)) {
        displayedContextList[translation] = {};
    }
    if (!(book in displayedContextList[translation])) {
        displayedContextList[translation][book] = {};
    }
    if (!(chapter in displayedContextList[translation][book])) {
        displayedContextList[translation][book][chapter] = {};
    }
    displayedContextList[translation][book][chapter][verse] = text;
}

/*
 * Vérifie si un mot a été sélectionné; si oui, affiche la boîte flechée.
 */

function checkSelectedWord()
{
    var selectionObj = window.getSelection();
    var word = getSelectedWord(selectionObj);
    if (word) {
        showArrowBox(selectionObj, word);
    } else {
        hideArrowBox();
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

/*
 * Affiche la traduction de comparaison.
 */

function displayCmpTranslation()
{
    compareTranslationCell.classList.remove("gone");
    translationCompTable.tHead.classList.remove("gone");
}

/*
 * Masque la traduction de comparaison.
 */

function hideCmpTranslation()
{
    compareTranslationCell.classList.add("gone");
    translationCompTable.tHead.classList.add("gone");
}
