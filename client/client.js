/**
 * "Bible Index" Javascript webclient.
 * 
 * Uses WebSockets in order to request verses from a server that handles various
 * bible's format.
 * 
 *  Copyright 2013 Houillon Nelson <houillon.nelson@gmail.com>
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

/**
 * Configuration du client WebSocket
 */

var host = "localhost:8080";
var ress = "/bible";

/**
 * Variables et objets globaux
 */

var bookListOl,
    filterForm,
    resultTable,
    filterBar,
    referenceSection,
    launchButton,
    cleanButton,
    reinitButton,
    fullBibleReference,
    suggestionListSection,
    referenceErrorSpan,
    spinnerImg,
    suggestionCloseImg,
    bottomBar,
    rightBar,
    verticalResizeBar,
    horizontalResizeBar,
    readTab,
    dictTab,
    readSection;

var selectedReferences  = {};

var searchVerseList  = {},
    contextVerseList = {};

var lastTimestampReceived = null;
var connectInterval = null;
var focusedBookLi = null;
var oldFilterBarValue = "";
var lastTranslationUsed = null;

var verticalResizeProceeding,
    horizontalResizeProceeding;

var lastContextualQueryReference  = null,
    lastContextualQueryBlockQuote = null;

 var accentMapping = [
    "ÀÁÂÄÆA",
    "àáâäæa",
    "ÈÉÊËE",
    "èéêëe",
    "ÌÍÎÏI",
    "ìíîïi",
    "ÑN",
    "ñn",
    "ÒÓÔÖO",
    "òóôöo",
    "ÙÚÛÜU",
    "ùúûüu"
];

/*
 * Récupère divers noeuds HTML dans des variables globales.
 * Amorce des écouteurs d'évènement.
 */

function init()
{
    // get
    bookListOl = document.getElementById("book_list");
    filterForm = document.forms["filtre"];
    resultTable = document.getElementById("resultats_recherche");
    launchButton = document.getElementById("lancer");
    cleanButton = document.getElementById("effacer");
    reinitButton = document.getElementById("reinitialiser");
    filterBar = document.getElementById("filtre_reference");
    referenceSection = document.getElementById("liste_reference");
    fullBibleReference = document.getElementById("bible_entiere");
    suggestionListSection = document.getElementById("suggestion_reference");
    referenceErrorSpan = document.getElementById("reference_error");
    spinnerImg = document.getElementById("spinner");
    suggestionCloseImg = document.getElementById("suggestion_close");
    bottomBar = document.getElementById("bottom");
    rightBar = document.getElementById("right");
    verticalResizeBar = document.getElementById("vertical-resize");
    horizontalResizeBar = document.getElementById("horizontal-resize");
    readTab = document.getElementById("tab-read")
    dictTab = document.getElementById("tab-dict");
    readSection = document.getElementById("lecture");
    // action
    filterForm.addEventListener("submit", enu, false);
    filterForm.addEventListener("submit", requestServerForSearch, false);
    filterBar.addEventListener("keyup", handleFilterBarKeyUp, false);
    filterBar.addEventListener("keydown", handleFilterBarKeyDown, false);
    window.addEventListener("keydown", handleGlobalKeyDown, false);
    reinitButton.addEventListener("click", reinitForm, false);
    reinitButton.addEventListener("click", enu, false);
    cleanButton.addEventListener("click", cleanSearchList, false);
    cleanButton.addEventListener("click", cleanContextList, false);
    cleanButton.addEventListener("click", enu, false);
    suggestionCloseImg.addEventListener("click", hideBookSuggestion, false);
    //window.addEventListener("hashchange", handleHashChange, false);
    // selectionne un nom de livre par click
    var list = bookListOl.children, n=0;
    for (var i=0, li; i < list.length; ++i) {
        li = list[i];
        li.addEventListener("click", function(e) {
            selectBookItem(this);
        }, false);
    }
    // resize
    verticalResizeBar.addEventListener("mousedown", initVerticalResize, false);
    window.addEventListener("mousemove", continueVerticalResize, false);
    window.addEventListener("mouseup", stopVerticalResize, false);
    horizontalResizeBar.addEventListener("mousedown", initHorizontalResize, false);
    window.addEventListener("mousemove", continueHorizontalResize, false);
    window.addEventListener("mouseup", stopHorizontalResize, false);
    // WS
    restoreFormState();
    connectToServer();
}

document.addEventListener("DOMContentLoaded", init, false);

// permet de filtrer les éléments nuls avec la méthode "Array.filter"
function ret(e) { return e; }
function enu(e) { e.preventDefault(); }

/**
 * Gestion de l'UI
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
    //a.href = "#ref="+encodeURIComponent(ref);
    a.addEventListener("click", function(e) {
        requestServerForContext(ref);
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
 */

function addBookToContextList(bookName)
{
    var h1 = document.createElement("h1");
    h1.appendChild(document.createTextNode(bookName));
    readSection.appendChild(h1);
}

/*
 * Ajoute un numéro de chapitre à la fin de la section de lecture.
 */

function addChapterToContextList(chapter)
{
    var h2 = document.createElement("h2");
    h2.appendChild(document.createTextNode(chapter));
    readSection.appendChild(h2);
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
    readSection.appendChild(q);
}

/*
 * Vide le panneau de lecture contextuelle.
 */

function cleanContextList()
{
    contextVerseList = {};
    while (readSection.childElementCount > 0) {
        readSection.removeChild(readSection.firstElementChild);
    }
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
    hideBookSuggestion();
    filterForm.reset();
    localStorage.clear();
    location.hash = "";
}

/*
 * Soumission du formulaire
 */

function isFormSubmitable()
{
    if (s && s.readyState == WebSocket.OPEN) {
        return true;
    }
    return false;
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
 * Saisie intelligente des références
 */

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
 * Capture les frappes clavier depuis la fenêtre en général.
 */

function handleGlobalKeyDown(e)
{
    switch (e.keyIdentifier) {
    // Sélectionne une proposition
    case "Enter":
        if (focusedBookLi) {
            selectBookItem(focusedBookLi);
            e.preventDefault();
            e.stopPropagation();
        }
        break;
    // Remonte dans la liste des références
    case "Up":
        if (!suggestionListSection.classList.contains("gone")) {
            e.preventDefault();
            focusPreviousBook();
        }
        break;
    // Descend dans la liste des références
    case "Down":
        if (!suggestionListSection.classList.contains("gone")) {
            e.preventDefault();
            focusNextBook();
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
 * (appuis bas)
 */
 
function handleFilterBarKeyDown(e)
{
    switch (e.keyIdentifier) {
    // Ajout de la référence
    case "Enter":
        if (addReference(filterBar.value)) {
            filterBar.value = null;
            referenceErrorSpan.classList.remove("error");
            hideBookSuggestion();
        } else {
            signalReferenceError();
        }
        e.preventDefault();
        break;
    // Remonte dans la liste des références
    case "Up":
        e.preventDefault();
        e.stopPropagation();
        focusPreviousBook();
        break;
    // Descend dans la liste des références
    case "Down":
        if (!suggestionListSection.classList.contains("gone")) {
            e.preventDefault();
            e.stopPropagation();
            filterBar.blur();
            focusNextBook();
        }
        // La boîte a été cachée 
        else {
            suggestBook(filterBar.value);
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
    // Backspace
    switch (e.keyIdentifier) {
    case "U+0008":
        // Éffacement complet du champs
        if (!filterBar.value) {
            referenceErrorSpan.classList.remove("error");
        }
        break;
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
    input.focus();
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

/**
 * Persistence des données saisies et récupérées
 */

function saveFormState()
{
    localStorage["tra"] = filterForm.elements["traduction"].value;
    localStorage["all"] = filterForm.elements["conjonction"].value;
    localStorage["one"] = filterForm.elements["quelconque"].value;
    localStorage["non"] = filterForm.elements["aucun"].value;
    localStorage["cas"] = filterForm.elements["case"].checked;
    localStorage["acc"] = filterForm.elements["accent"].checked;
    localStorage["bou"] = filterForm.elements["mot"].checked;
    localStorage["ran"] = filterForm.elements["nombres_min"].value + ","
                        + filterForm.elements["nombres_max"].value;
    var refs = [];
    for (var r in selectedReferences) {
        refs.push(r);
    }
    localStorage["ref"] = refs;
}

function restoreFormState()
{
    if ("tra" in localStorage) {
        filterForm.elements["traduction"].value = localStorage["tra"];
        lastTranslationUsed = localStorage["tra"];
    }
    if ("all" in localStorage) {
        filterForm.elements["conjonction"].value = localStorage["all"];
    }
    if ("one" in localStorage) {
        filterForm.elements["quelconque"].value = localStorage["one"];
    }
    if ("non" in localStorage) {
        filterForm.elements["aucun"].value = localStorage["non"];
    }
    if ("cas" in localStorage) {
        filterForm.elements["case"].checked = (localStorage["cas"] == "true");
    }
    if ("acc" in localStorage) {
        filterForm.elements["accent"].checked = (localStorage["acc"] == "true");
    }
    if ("bou" in localStorage) {
        filterForm.elements["mot"].checked = (localStorage["bou"] == "true");
    }
    if ("ran" in localStorage) {
        var range = localStorage["ran"].split(",");
        filterForm.elements["nombres_min"].value = range[0];
        filterForm.elements["nombres_max"].value = range[1];
    }
    if ("ref" in localStorage) {
        var refs = localStorage["ref"].split(",");
        for (var i=0, s, reference; i < refs.length; ++i) {
            s = refs[i];
            addReference(s);
        }
    }
}

/**
 * Gestion des URI (gérées par le hash "#" dans l'URL)
 */

/*
 * Extrait les propriétés du hash et les retournes sous la forme d'un
 * dictionnaire.
 */

function handleHashChange(e)
{
    var s = window.location.hash;
    if (!s) return;
    s = s.slice(1);
    var parts = s.split("&"), prop = {};
    for (var i=0, pair; i < parts.length; ++i) {
        pair = parts[i].split("=");
        prop[pair[0]] = decodeURIComponent(pair[1]);
    }
    parseHashProperties(prop);
}

/*
 * Traite les propriétés du hash.
 */

function parseHashProperties(prop)
{
    if ("ref" in prop) {
        requestServerForContext(prop["ref"]);
    }
}

/**
 * Gestion du protocole
 */

/* 
 * Envoi une requête de recherche de versets.
 */

function requestServerForSearch()
{
    if (!s) return;
    saveFormState();
    var dict = {
        "now": new Date().getTime(),
        "ref": [],
        "tra": filterForm.elements["traduction"].value,
        "bou": filterForm.elements["mot"].checked,
        "cas": filterForm.elements["case"].checked,
        "acc": filterForm.elements["accent"].checked,
        "tok": "search"
    };
    lastTranslationUsed = filterForm.elements["traduction"].value;
    var allWords   = filterForm.elements["conjonction"].value;
    var oneOfWords = filterForm.elements["quelconque"].value;
    var noneWords  = filterForm.elements["aucun"].value;
    var numLow     = filterForm.elements["nombres_min"].value;
    var numHigh    = filterForm.elements["nombres_max"].value;
    if (allWords.length) {
        dict["all"] = allWords.split(/\s+/).filter(ret);
    }
    if (oneOfWords.length) {
        dict["one"] = oneOfWords.split(/\s+/).filter(ret);
    }
    if (noneWords.length) {
        dict["non"] = noneWords.split(/\s+/).filter(ret);
    }
    if (numLow && numHigh) {
        dict["ran"] = [numLow, numHigh];
    }
    for (var r in selectedReferences) {
        dict["ref"].push(r);
    }
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}

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
 * Construit une chaîne de requète URI à partir d'un blob
 */

function dictToQueryString(dict)
{
    var s="", e, first = true;
    for (e in dict) {
        if (!first) {
            s += "&";
        } else {
            first = false;
        }
        s += e+"="+dict[e];
    }
    return s;
}

/**
 * Redimensionnement
 */

/*
 * Vertical
 */

function initVerticalResize(e)
{
    verticalResizeProceeding = {
        "initial_h": bottomBar.offsetHeight,
        "initial_y": e.clientY
    };
    e.preventDefault();
}

function continueVerticalResize(e)
{
    if (!verticalResizeProceeding) return;
    var diff = e.clientY - verticalResizeProceeding["initial_y"];
    var newHeight = verticalResizeProceeding["initial_h"] - diff;
    if (newHeight > 0) {
        bottomBar.style.height = newHeight+"px";
    }
}

function stopVerticalResize(e)
{
    verticalResizeProceeding = null;
}

/*
 * Horizontal
 */

function initHorizontalResize(e)
{
    horizontalResizeProceeding = {
        "initial_w": rightBar.offsetWidth,
        "initial_x": e.clientX
    };
    e.preventDefault();
}

function continueHorizontalResize(e)
{
    if (!horizontalResizeProceeding) return;
    var diff = e.clientX - horizontalResizeProceeding["initial_x"];
    var newWidth = horizontalResizeProceeding["initial_w"] - diff;
    if (newWidth > 0) {
        rightBar.style.width = newWidth+"px";
    }
}

function stopHorizontalResize(e)
{
    horizontalResizeProceeding = null;
}

/**
 * Gestion de la connection WebSocket
 */

var s;

function triggerConnected(e)
{
    if (connectInterval) {
        clearInterval(connectInterval);
        connectInterval = null;
    }
    spinnerImg.classList.add("gone");
}

function handleMessage(e)
{
    if (typeof(e.data) == "object") return; // Blob
    var resp = JSON.parse(e.data);
    if (!("res" in resp) || !("now" in resp) || !("tok" in resp)) {
        console.error("malformed JSON received");
        return;
    }
    switch (resp["tok"]) {
    // Retour d'une recherche
    case "search":
        handleSearchResponse(resp["res"]);
        break;
    // Retour d'une demande de versets
    case "context":
        handleContextResponse(resp["res"]);
        break;
    default:
        console.error("unknown token");
        break;
    }
}

/*
 * Fonction de manipulation des réponses du serveur concernant les recherches.
 */

function handleSearchResponse(res)
{
    cleanSearchList();
    for (var i=0, ref; i < res.length; ++i) {
        ref = res[i];
        addVerseToSearchList(ref["ref"], ref["verse"]);
    }
    toggleCleanButton();
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
    // à cet instant, cette variable désigne le noeud <blockquote> du verset
    // clé
    if (lastContextualQueryBlockQuote) {
        lastContextualQueryBlockQuote.scrollIntoView();
        lastContextualQueryBlockQuote = null;
    }
    if (!bottomBar.style.height) {
        bottomBar.style.height = "50%";
    }
}

function handleError(e)
{
    if (s && s.readyState == WebSocket.OPEN) {
        s.close();
    }
};

function triggerClosed(e)
{
    s = null;
    if (!connectInterval) {
        connectInterval = setInterval(connectToServer, 10000);
    }
    spinnerImg.classList.remove("gone");
}

function connectToServer()
{
    if (s && s.readyState == WebSocket.OPEN) {
        s.close();
    }
    s = new WebSocket("ws://"+host+ress);	
    s.addEventListener("open",    triggerConnected, false);
    s.addEventListener("message", handleMessage, false);
    s.addEventListener("error",   handleError, false);
    s.addEventListener("close",   triggerClosed, false);
    // bouton de recherche
    s.addEventListener("open",  toggleLaunchButton, false);
    s.addEventListener("close", toggleLaunchButton, false);
    s.addEventListener("error", toggleLaunchButton, false);
}

/*
 * Déconnexion propre en case de sortie de page
 */

window.addEventListener("beforeunload", function() {
    if (s) s.close();
}, false);

/**
 * Classe décrivant une référence biblique.
 * Utiliser "parse" pour extraire les propriétés de la chaîne et "serialize"
 * pour construire une référence propre.
 */

function Reference(referenceStr)
{
    this.referenceStr = referenceStr;
    
    this.book    = null;
    this.chapterRange = {"low": null, "high": null};
    this.verseRange   = {"low": null, "high": null};
    
    /*
     * Construit une expression de reconnaissance de références valides.
     */
    
    var w = "a-zA-Z";
    for (var i=0, s; i < accentMapping.length; ++i) {
        s = accentMapping[i].slice(0,-1);
        w += s;
    }
    w = "["+w+"]";
    
    var d = "[0-9]";
    
    this.testReference = new RegExp("^(([123] )?"+w+"+)( "+d+"+(-"+d+"+)?(\\."+d+"+(-"+d+"+)?)?)?$");
    
    /*
     * Reconstruit la référence de manière propre.
     */
    
    this.serialize = function() {
        var ref = this.book;
        if (this.chapterRange["low"]) {
            ref += " " + this.chapterRange["low"];
            if (this.chapterRange["high"]) {
                ref += "-" + this.chapterRange["high"];
            }
        }
        if (this.verseRange["low"]) {
            ref += "." + this.verseRange["low"];
            if (this.verseRange["high"]) {
                ref += "-" + this.verseRange["high"];
            }
        }
        return ref;
    };
    
    /*
     * Découpe la référence pour en extraire les propriétés.
     * Il est obligatoire de trouver au moins le nom de chapitre.
     */

    this.parse = function() {
        // Test préliminaire de reconnaissance
        if (!this.testReference.test(this.referenceStr)) {
            return false;
        }
        var fragments = this.referenceStr.split(/\s+/);
        if (fragments.length < 1) return false;
        /* Extrait le nom du livre
         */
        this.book = fragments[0];
        // le premier élément est le numéro du livre
        if (isNaN(fragments[0])) {
            fragments = fragments.slice(1,fragments.length);
        } else {
            this.book += " " + fragments[1];
            fragments = fragments.slice(2,fragments.length);
        }
        // vérification du nom du livre
        var found = false, list = bookListOl.children;
        for (var i=0, li; i < list.length; ++i) {
            li = list[i];
            if (this.book == li.textContent) {
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
        // Le nom du livre n'est pas suivi d'autres informations
        if (fragments.length == 0) {
            return true;
        }
        /* Extraction de l'intervalle des chapitres
         */
        fragments = fragments[0].split(".");
        var pair = fragments[0].split("-");
        this.chapterRange["low"]  = pair[0];
        if (pair.length == 2) {
            this.chapterRange["high"] = pair[1];
        }
        /* Extraction de l'intervalle des versets
         */
        if (fragments.length == 2) {
            pair = fragments[1].split("-");
            this.verseRange["low"]  = pair[0];
            if (pair.length == 2) {
                this.verseRange["high"] = pair[1];
            }
        }
        return true;
    };
}
