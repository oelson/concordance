/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la gestion des fonctionnalités de base de l'UI.
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
 * Ajoute une référence à partir d'une chaîne, éventuellement malformée.
 * Un objet de type "Reference" est instancié pour filtrer les mauvaises 
 * références.
 * Ajoute un libellé à l'écran si la référence est bonne.
 */

function addReference(s)
{
    var reference = new Reference(s);
    if (reference.parse()) {
        s = reference.serialize();
        // met-à-jour la liste des références
        selectedReferences[s] = reference;
        addReferenceLabel(s);
        // masque la référence globale
        fullBibleReference.classList.add("gone");
        return true;
    } else {
        console.error('bad reference "'+s+'"');
    }
    return false;
}

/*
 * Affiche un libellé correspondant à une référence passée en argument sous la
 * forme d'une chaîne de caractères.
 */

function addReferenceLabel(s)
{
    var ctn = document.createElement("span"),
        del = document.createElement("span");
    ctn.classList.add("reference");
    ctn.appendChild(document.createTextNode(s));
    del.classList.add("delete");
    del.addEventListener("click", removeReference, false);
    // rétrolien pour la mise-à-jour de la liste en cas de suppression
    del.reference = s;
    ctn.appendChild(del);
    referenceSection.appendChild(ctn);
}

/*
 * Supprime une référence de l'interface depuis un évènement de clic dirigé sur
 * un des libellés.
 */

function removeReference(e)
{
    delete selectedReferences[e.target.reference];
    referenceSection.removeChild(e.target.parentNode);
    if (referenceSection.childElementCount == 1) {
        fullBibleReference.classList.remove("gone");
    }
}

/*
 * Efface toutes les références affichées et vide le dictionnaire correspondant.
 */

function cleanReferenceList()
{
    for (var r in selectedReferences) delete selectedReferences[r];
    var spans = referenceSection.getElementsByClassName("reference");
    for (var i=0, span; i < spans.length; ++i) {
        span = spans[i];
        if (!span.hasAttribute("id")) {
            referenceSection.removeChild(span);
        }
    }
    fullBibleReference.classList.remove("gone");
}

/*
 * Surbrillance des résultats
 */

function highlightMatches(s)
{
    var q = document.createElement("blockquote"), e;
    var pairs = s.split("_");
    for (var i=0; i < pairs.length; ++i) {
        // texte inchangé
        t = document.createTextNode(pairs[i]);
        // texte encadré
        if (i%2) {
            e = document.createElement("mark");
            e.appendChild(t);
        } else {
            e = t;
        }
        q.appendChild(e);
    }
    return q;
}

/*
 * Affichage des références ayant correspondu à la recherche
 */

function addVerseToSearchList(ref, verse)
{
    var tr  = document.createElement("tr");
    var td1 = document.createElement("td"),
        td2 = document.createElement("td");
    var tbody = resultTable.tBodies[0];
    var a = document.createElement("a");
    a.addEventListener("click", function(e) {
        requestServerForContext(ref);
        if (activeReferenceLink) {
            activeReferenceLink.classList.remove("active");
        }
        this.classList.add("active");
        activeReferenceLink = this;
    }, false);
    a.classList.add("decore-hover");
    a.appendChild(document.createTextNode(ref));
    td1.appendChild(a);
    var q = highlightMatches(verse);
    td2.appendChild(q);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
    searchVerseList[ref] = verse;
    resultTable.classList.remove("gone");
}

/*
 * Efface tous les versets affichés.
 */

function cleanSearchList()
{
    searchVerseList = {};
    var tbody = resultTable.tBodies[0];
    while (tbody.childElementCount > 1) {
        tbody.removeChild(tbody.lastChild);
    }
    resultTable.classList.add("gone");
    toggleCleanButton();
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
    var coor = getAbsoluteCoordinates(contextSection);
    x -= coor["x"];
    y -= coor["y"];
    // Tient compte du défilement
    x += contextSection.scrollLeft;
    y += contextSection.scrollTop;
    // CSS
    arrowBoxSection.style.left = x+"px";
    arrowBoxSection.style.top  = y+"px";
    arrowBoxSection.classList.remove("hidden");
}

/*
 * Cache la boîte de dialogue fléchée.
 */

function hideArrowBox()
{
    arrowBoxSection.classList.add("hidden");
}

/*
 * Retourne les coordonnées absolues d'un élément.
 */

function getAbsoluteCoordinates(el)
{
    var x=0, y=0
    while (el) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent;
    }
    return {"x": x, "y": y};
}

/*
 * Réinitialise le formulaire:
 *   . efface les références affichées
 *   . efface les suggestions de livres
 *   . efface les champs du formulaire
 * Et sauvegarde ce nouvel état.
 */

function reinitForm()
{
    cleanReferenceList();
    filterForm.reset();
    localStorage.clear();
    toggleCleanButton();
    toggleLaunchButton();
}

/*
 * Soumission du formulaire
 */

function isFormSubmitable()
{
    // Refuse la soumission si aucun mot-clé n'est donné
    var requiredInputs = filterForm.getElementsByClassName("required");
    var isFormFilled = false;
    for (var i=0, inp; i < requiredInputs.length; ++i) {
        inp = requiredInputs[i];
        if (inp.value) {
            isFormFilled = true;
            break;
        }
    }
    if (!isFormFilled) {
        return false;
    }
    if (!s || s.readyState != WebSocket.OPEN) {
        return false;
    }
    return true;
}

/*
 * Retourne vrai lorsque des versets sont affichés.
 */

function isUICleanable()
{
    return resultTable.tBodies[0].childElementCount > 1;
}

/*
 * Active ou non le bouton de nettoyage de l'interface.
 */

function toggleCleanButton()
{
    cleanButton.disabled = !isUICleanable();
}

/*
 * Active ou non le bouton de recherche.
 */

function toggleLaunchButton()
{
    launchButton.disabled = !isFormSubmitable();
}

/**
 * Dictionnaire
 */

/*
 * Affiche une définition
 */

function displayDictionnaryEntry(entry)
{
    termeCell.appendChild(document.createTextNode(entry["nom"]));
    natureCell.appendChild(document.createTextNode(entry["nature"]));
    prononciationCell.appendChild(document.createTextNode(entry["prononciation"]));
}

/*
 * Gestion de l'affichage des définitions du dictionnaire.
 */

function hideDictionnaryUselessLines()
{
    if (!termeCell.firstChild) {
        termeCell.parentNode.classList.add("gone");
    }
    if (!natureCell.firstChild) {
        natureCell.parentNode.classList.add("gone");
    }
    if (!prononciationCell.firstChild) {
        prononciationCell.parentNode.classList.add("gone");
    }
    if (!domaineCell.firstChild) {
        domaineCell.parentNode.classList.add("gone");
    }
    if (!etymologieCell.firstChild) {
        etymologieCell.parentNode.classList.add("gone");
    }
    if (!variantesCell.firstChild) {
        variantesCell.parentNode.classList.add("gone");
    }
    if (!citationsCell.firstChild) {
        citationsCell.parentNode.classList.add("gone");
    }
}

/*
 * Vérifie l'intégrité de l'intervalle des nombres.
 */

function handleMinMaxValuesChange(e)
{
    var isMinInput = this == filterForm.elements["nombres_min"];
    var min = parseInt(filterForm.elements["nombres_min"].value);
    var max = parseInt(filterForm.elements["nombres_max"].value);
    // la valeur minimale a changé
    if (isMinInput) {
        if (min == max) {
            filterForm.elements["nombres_max"].value = min+1;
        }
    }
    // la valeur maximale a changé
    else {
        if ((isNaN(min) && !isNaN(max)) || (min == max)) {
            filterForm.elements["nombres_min"].value = max-1;
        }
    }
}

/*
 * Gestion des onglets du bas : onglet de lecture contextuelle.
 */

function showContextTab()
{
    if (!bottomBar.style.height) {
        bottomBar.style.height = "50%";
    }
    dictionnaryTab.classList.remove("selected");
    contextTab.classList.add("selected");
    contextSection.classList.remove("gone");
    dictionnarySection.classList.add("gone");
}

/*
 * Gestion des onglets du bas : onglet du dictionnaire.
 */

function showDictionnaryTab()
{
    if (!bottomBar.style.height) {
        bottomBar.style.height = "50%";
    }
    contextTab.classList.remove("selected");
    dictionnaryTab.classList.add("selected");
    contextSection.classList.add("gone");
    dictionnarySection.classList.remove("gone");
}
