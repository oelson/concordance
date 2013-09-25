/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la gestion de la connection WebSocket.
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
 * Adresse du serveur.
 */

var host = "localhost:8080";
var ress = "/bible";

// représente la connexion websocket
var s;

/*
 * Fonction déclenchée lorsque la connexion est attestée.
 */

function triggerConnected(e)
{
    if (connectInterval) {
        clearInterval(connectInterval);
        connectInterval = null;
    }
    spinnerImg.classList.add("gone");
}

/*
 * Récupère un message envoyé par le serveur. Le format attendu est un JSON
 * sérialisé.
 */

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
    // Retour d'une demande de définition
    case "dictionnary":
        handleDictionnaryResponse(resp["res"]);
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
    if (!bottomBar.style.height) {
        bottomBar.style.height = "50%";
    }
    // à cet instant, cette variable désigne le noeud <blockquote> du verset
    // clé
    if (lastContextualQueryBlockQuote) {
        lastContextualQueryBlockQuote.scrollIntoView();
        lastContextualQueryBlockQuote = null;
    }
}

/*
 * Fonction de manipulation des réponses du serveur concernant les recherches
 * dans le dictionnaire.
 */

function handleDictionnaryResponse(res)
{
    // TODO
    console.log(res);
}

/*
 * Fonction appellée lorsqu'une erreur de connexion survient.
 */

function handleError(e)
{
    if (s && s.readyState == WebSocket.OPEN) {
        s.close();
    }
};

/*
 * Fonction appellée lorsque la connexion est fermée.
 */

function triggerClosed(e)
{
    s = null;
    // tente une reconnexion périodique
    if (!connectInterval) {
        connectInterval = setInterval(connectToServer, 10000);
    }
    spinnerImg.classList.remove("gone");
}

/*
 * Tentative de connexion au serveur.
 */

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
    var exactExpr  = filterForm.elements["expression"].value;
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
    if (exactExpr) {
        exactExpr = exactExpr.replace(/\s+/g, " ").replace(/^ /, "").replace(/ $/, "");
        if (exactExpr) {
            dict["exp"] = exactExpr;
        }
    }
    if (numLow) {
        var ranDict = {"l": numLow};
        if (numHigh) {
            ranDict["h"] = numHigh;
        }
        dict["ran"] = ranDict;
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
 * Procède à une demande de définition dans le dictionnaire.
 */
 
function requestServerForDictionnary(word)
{
    if (!s) return;
    var dict = {
        "now": new Date().getTime(),
        "tok": "dictionnary"
    };
    // TODO
    console.log(dict);
    //var jsonData = JSON.stringify(dict);
    //s.send(jsonData);
}
