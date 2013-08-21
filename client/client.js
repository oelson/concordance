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
    resetButton,
    fullBibleReference,
    suggestionListSection,
    referenceErrorSpan,
    spinnerImg,
    suggestionCloseImg;

var selectedReferences  = {};
var displayedVerses = {};

var bookIndex = [];

var lastTimestampReceived = null;
var connectInterval = null;

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
    resetButton = document.getElementById("effacer");
    filterBar = document.getElementById("filtre_reference");
    referenceSection = document.getElementById("liste_reference");
    fullBibleReference = document.getElementById("bible_entiere");
    suggestionListSection = document.getElementById("suggestion_reference");
    referenceErrorSpan = document.getElementById("reference_error");
    spinnerImg = document.getElementById("spinner");
    suggestionCloseImg = document.getElementById("suggestion_close");
    // action
    var bookList = bookListOl.children;
    for (var i=0; i < bookList.length; ++i) {
        bookIndex.push(bookList[i].textContent);
    }
    filterForm.addEventListener("submit", enu, false);
    filterForm.addEventListener("submit", requestServer, false);
    filterBar.addEventListener("keyup", handleFilterBarKeyUp, false);
    filterBar.addEventListener("keydown", handleFilterBarKeyDown, false);
    resetButton.addEventListener("click", resetUI, false);
    suggestionCloseImg.addEventListener("click", hideBookSuggestion, false);
    // WS
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
 * Liste des références sélectionnées
 */

function addReference(reference)
{
    // met-à-jour la liste des références
    selectedReferences[reference.serialize()] = reference;
    addReferenceLabel(reference);
    // masque la référence globale
    fullBibleReference.classList.add("gone");
    toggleResetButton();
}

function addReferenceLabel(reference)
{
    var ctn = document.createElement("span"),
        del = document.createElement("span");
    ctn.classList.add("reference");
    var s = reference.serialize();
    ctn.appendChild(document.createTextNode(s));
    del.classList.add("delete");
    del.addEventListener("click", removeReference, false);
    // rétrolien pour la mise-à-jour de la liste en cas de suppression
    del.reference = s;
    ctn.appendChild(del);
    referenceSection.appendChild(ctn);
}

function removeReference(e)
{
    delete selectedReferences[e.target.reference];
    referenceSection.removeChild(e.target.parentNode);
    if (referenceSection.childElementCount == 1) {
        fullBibleReference.classList.remove("gone");
    }
    toggleResetButton();
}

function cleanReferenceList()
{
    selectedReferences = {};
    var spans = referenceSection.getElementsByClassName("reference");
    for (var i=0, span; i < spans.length; ++i) {
        span = spans[i];
        if (!span.hasAttribute("id")) {
            referenceSection.removeChild(span);
        }
    }
    fullBibleReference.classList.remove("gone");
    toggleResetButton();
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

function displayVerse(ref, verse)
{
    var tr  = document.createElement("tr");
    var td1 = document.createElement("td"),
        td2 = document.createElement("td");
    var tbody = resultTable.tBodies[0];
    td1.appendChild(document.createTextNode(ref));
    var q = highlightMatches(verse);
    td2.appendChild(q);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
    displayedVerses[ref] = verse;
    resultTable.classList.remove("gone");
    toggleResetButton();
}

function cleanDisplayedVerses()
{
    displayedVerses = {};
    var tbody = resultTable.tBodies[0];
    while (tbody.childElementCount > 1) {
        tbody.removeChild(tbody.lastChild);
    }
    toggleResetButton();
    resultTable.classList.add("gone");
}

function resetUI()
{
    cleanDisplayedVerses();
    clearBookSuggestion();
    filterForm.reset();
}

/*
 * Saisie intelligente des références
 */

function handleFilterBarKeyUp(e)
{
    // Backspace
    if (e.keyCode == 8) {
        // Éffacement complet du champs
        if (!filterBar.value) {
            referenceErrorSpan.classList.remove("error");
            hideBookSuggestion();
        }
    }
    suggestBook(filterBar.value);
}

function handleFilterBarKeyDown(e)
{
    // Ajout de la référence
    if (e.keyIdentifier == "Enter") {
        var reference = new Reference(filterBar.value);
        if (reference.parse()) {
            addReference(reference);
            filterBar.value = null;
            referenceErrorSpan.classList.remove("error");
            hideBookSuggestion();
        } else {
            signalReferenceError();
        }
        e.preventDefault();
    }
}

/*
 * Détermine quel livre biblique est en train d'être ciblé au clavier
 */

function suggestBook(input)
{
    clearBookSuggestion();
    var suggestList = [];
    for (var i=0, book; i < bookIndex.length; ++i) {
        book = bookIndex[i];
        if (looksLike(input, book)) {
            suggestList.push(book);
        }
    }
    if (suggestList.length > 0) {
        displayBookSuggestion(suggestList);
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
    // TODO vérifier si l'entrée contient "plus" que le nom du livre
    return new RegExp(input, 'i').test(book);
}

function displayBookSuggestion(list)
{
    for (var i=0, li, book; i < list.length; ++i) {
        book = list[i];
        li = document.createElement("li");
        li.appendChild(document.createTextNode(book));
        suggestionListSection.appendChild(li);
    }
    suggestionListSection.classList.remove("gone");
}

function clearBookSuggestion()
{
    var liList = suggestionListSection.getElementsByTagName("li");
    for (var i=0, li, l=liList.length; i < l; ++i) {
        suggestionListSection.removeChild(liList[0]);
    }
}

function hideBookSuggestion()
{
    suggestionListSection.classList.add("gone");
    clearBookSuggestion();
}

/*
 * Affiche l'avertissement de référence eronnée
 */

function signalReferenceError()
{
    referenceErrorSpan.classList.add("error");
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

function isUICleanable()
{
    return resultTable.tBodies[0].childElementCount > 1;
}

function toggleResetButton()
{
    resetButton.disabled = !isUICleanable();
}

function toggleLaunchButton()
{
    launchButton.disabled = !isFormSubmitable();
}

/**
 * Gestion du protocole
 */

/* 
 * Envoi une requête de versets
 */

function requestServer()
{
    if (!s) {
        return;
    }
    var dict = {
        "now": new Date().getTime(),
        "ref": [],
        "tra": filterForm.elements["choix_traduction"].value,
        "bou": filterForm.elements["filtre_mot"].checked,
        "cas": filterForm.elements["filtre_case"].checked,
        "acc": filterForm.elements["filtre_accent"].checked
    };
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
    // Envoi au serveur websocket
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
    if (!("res" in resp) || !("now" in resp)) {
        console.error("malformed JSON received");
        return;
    }
    cleanDisplayedVerses();
    for (var i=0, ref; i < resp["res"].length; ++i) {
        ref = resp["res"][i];
        displayVerse(ref["ref"], ref["verse"]);
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
    this.chapter = null;
    this.range   = {"low": null, "high": null};
    
    this.serialize = function() {
        var ref = this.book;
        if (this.chapter) {
            ref += " " + this.chapter;
        }
        if (this.range["low"]) {
            ref += "." + this.range["low"];
            if (this.range["high"]) {
                ref += "-" + this.range["high"];
            }
        }
        return ref;
    };
    
    this.filterWhiteStr = function(s)
    {
        return s.length > 0 && s.search(/^\s+$/) == -1;
    }
    
    /*
     * Obligatoire de trouver au moins le nom de chapitre
     */

    this.parse = function() {
        var fragments = this.referenceStr.split(/\s+/).filter(this.filterWhiteStr);
        if (fragments.length < 1) return false;
        // nom du livre
        this.book = fragments[0];
        // le premier élément est le numéro du livre
        if (isNaN(fragments[0])) {
            fragments = fragments.slice(1,fragments.length);
        } else {
            this.book += " " + fragments[1];
            fragments = fragments.slice(2,fragments.length);
        }
        // vérification du nom du livre
        if (bookIndex.indexOf(this.book) == -1) {
            return false;
        }
        // chapitre
        if (fragments.length == 0) {
            return true;
        } else if (isNaN(fragments[0])) {
            return false;
        } else {
            this.chapter = fragments[0];
            fragments = fragments.slice(1,fragments.length);
        }
        // point
        if (fragments.length == 0) {
            return true;
        } else if (fragments[0] != ".") {
            return false;
        } else {
            fragments = fragments.slice(1,fragments.length);
        }
        // indice haut
        if (fragments.length == 0) {
            return true;
        } else if (isNaN(fragments[0])) {
            return false;
        } else {
            this.range["low"] = fragments[0];
            fragments = fragments.slice(1,fragments.length);
        }
        // tiret
        if (fragments.length == 0) {
            return true;
        } else if (fragments[0] != "-") {
            return false;
        } else {
            fragments = fragments.slice(1,fragments.length);
        }
        // indice bas
        if (fragments.length == 0) {
            return false;
        } else if (isNaN(fragments[0])) {
            return false;
        } else {
            this.range["high"] = fragments[0];
        }
        return true;
    };
}
