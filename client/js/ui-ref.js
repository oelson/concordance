/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à l'assistance à la saisie des références.
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
 * Focus la liste des suggestions et sélectionne l'élément suivant.
 */

function focusNextBook()
{
    var oldFocusedBookLi = focusedBookLi, newFocusedBookLi;
    // Descend d'un item
    if (focusedBookLi) {
        newFocusedBookLi = focusedBookLi;
        do {
            newFocusedBookLi = newFocusedBookLi.nextElementSibling;
        }
        while (newFocusedBookLi && newFocusedBookLi.classList.contains("gone"));
    }
    // Déplace le focus sur la liste des suggestions
    else {
        newFocusedBookLi = bookListOl.firstElementChild;
        while (newFocusedBookLi && newFocusedBookLi.classList.contains("gone")) {
            newFocusedBookLi = newFocusedBookLi.nextElementSibling;
        }
    }
    if (oldFocusedBookLi != newFocusedBookLi) {
        if (newFocusedBookLi) {
            if (oldFocusedBookLi) {
                oldFocusedBookLi.classList.remove("focused");
            }
            newFocusedBookLi.classList.add("focused");
            focusedBookLi = newFocusedBookLi;
        }
    }
}

/*
 * Focus la liste des suggestions et sélectionne l'élément précédent.
 */

function focusPreviousBook()
{
    var oldFocusedBookLi = focusedBookLi, newFocusedBookLi;
    // Descend d'un item
    if (focusedBookLi) {
        newFocusedBookLi = focusedBookLi;
        do {
            newFocusedBookLi = newFocusedBookLi.previousElementSibling;
        }
        while (newFocusedBookLi && newFocusedBookLi.classList.contains("gone"));
    }
    // Déplace le focus sur la barre de recherche
    else {
        filterBar.focus();
    }
    if (oldFocusedBookLi != newFocusedBookLi) {
        if (newFocusedBookLi) {
            if (oldFocusedBookLi) {
                oldFocusedBookLi.classList.remove("focused");
            }
            newFocusedBookLi.classList.add("focused");
            focusedBookLi = newFocusedBookLi;
        }
    }
}

/*
 * Routine pour sélectionner un élément de la liste des livres.
 * Remplis la barre de recherche avec le nom du livre.
 */

function selectBookItem(li)
{
    hideBookSuggestion();
    filterBar.value = li.textContent;
    // Focus la barre de recherche
    putCarretToEnd(filterBar);
    // Évite de réafficher la boîte de suggestions
    oldFilterBarValue = filterBar.value;
}

/*
 * Essaye de valider la référence se trouvant dans la barre de recherche.
 */

function submitReference()
{
    if (filterBar.value) {
        if (addReference(filterBar.value)) {
            filterBar.value = null;
            referenceErrorSpan.classList.remove("error");
            hideBookSuggestion();
        } else {
            signalReferenceError();
        }
    }
}

/*
 * Capture les frappes clavier depuis la barre de recherche des références.
 * (appuis bas)
 */

function handleFilterBarKeyDown(e)
{
    switch (e.keyIdentifier) {
    // Ajout de la référence
    case "Enter":
        e.preventDefault();
        if (focusedBookLi) {
            selectBookItem(focusedBookLi);
        } else {
            submitReference();
        }
        break;
    // Remonte dans la liste des références
    case "Up":
        e.preventDefault();
        if (!suggestionListSection.classList.contains("gone")) {
            focusPreviousBook();
        }
        break;
    // Descend dans la liste des références
    case "Down":
        e.preventDefault();
        if (!suggestionListSection.classList.contains("gone")) {
            focusNextBook();
        }
        // La boîte a été cachée 
        else {
            suggestBook(filterBar.value);
        }
        break;
    // Échap
    case "U+001B":
        if (!suggestionListSection.classList.contains("gone")) {
            hideBookSuggestion();
            // Focus la barre de recherche
            putCarretToEnd(filterBar);
        }
        break;
    }
}

/*
 * Capture les frappes clavier depuis la barre de recherche des références.
 * (appuis haut)
 */

function handleFilterBarKeyUp(e)
{
    // Éffacement complet du champs
    if (!filterBar.value) {
        referenceErrorSpan.classList.remove("error");
    }
    if (oldFilterBarValue != filterBar.value) {
        suggestBook(filterBar.value);
        oldFilterBarValue = filterBar.value;
    }
}

/*
 * Focus un champs et déplace le curseur à la fin du texte.
 */

function putCarretToEnd(input)
{
    input.selectionStart = input.value.length;
    input.selectionEnd = input.value.length;
}

/*
 * Détermine quel livre biblique est en train d'être ciblé au clavier
 */

function suggestBook(input)
{
    var list = bookListOl.children, n=0;
    for (var i=0, li; i < list.length; ++i) {
        li = list[i];
        if (looksLike(input, li.textContent)) {
            li.classList.remove("gone");
            ++n;
        } else {
            li.classList.add("gone");
        }
    }
    if (n > 0) {
        displayBookSuggestion();
    } else {
        hideBookSuggestion();
    }
}

/*
 * Fonction de ressemblance
 */
 
function looksLike(input, book)
{
    if (input.length < 2) {
        return false;
    }
    // Ignore les accents
    for (var i=0, s; i < accentMapping.length; ++i) {
        s = "["+accentMapping[i]+"]";
        input = input.replace(new RegExp(s, 'g'), s);
    }
    return new RegExp(input, 'i').test(book);
}

/*
 * Affiche la liste des suggestions de livres.
 */

function displayBookSuggestion()
{
    suggestionListSection.classList.remove("gone");
}

/*
 * Masque, puis efface la liste des suggestions de livres.
 */

function hideBookSuggestion()
{
    if (focusedBookLi) {
        focusedBookLi.classList.remove("focused");
        focusedBookLi = null;
    }
    suggestionListSection.classList.add("gone");
}

/*
 * Affiche l'avertissement de référence eronnée
 */

function signalReferenceError()
{
    referenceErrorSpan.classList.add("error");
}
