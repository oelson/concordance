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
 * TODO scinder ce fichier en ws.js + protocol.js
 * TODO ajouter la gestion des statistiques de la recherche
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
    showContextTab();
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
//XXX
console.log(res);
return;
//XXX
    // Mot recherché
    if ("mot" in res) {
        if (termeCell.firstChild) {
            termeCell.removeChild(termeCell.firstChild);
        }
        termeCell.appendChild(document.createTextNode(res["mot"]));
        termeCell.parentNode.classList.remove("gone");
    } else {
        termeCell.parentNode.classList.add("gone");
    }
    // Nature du mot
    if ("nature" in res) {
        if (natureCell.firstChild) {
            natureCell.removeChild(natureCell.firstChild);
        }
        natureCell.appendChild(document.createTextNode(res["nature"]));
        natureCell.parentNode.classList.remove("gone");
    } else {
        natureCell.parentNode.classList.add("gone");
    }
    // Prononciation du mot
    if ("prononciation" in res) {
        if (prononciationCell.firstChild) {
            prononciationCell.removeChild(prononciationCell.firstChild);
        }
        prononciationCell.appendChild(document.createTextNode(res["prononciation"]));
        prononciationCell.parentNode.classList.remove("gone");
    } else {
        prononciationCell.parentNode.classList.add("gone");
    }
    // Variantes du mot
    if ("variantes" in res) {
        if (variantesCell.firstChild) {
            variantesCell.removeChild(variantesCell.firstChild);
        }
        // Énumération des variantes du mot
        olEl = buildVarianteList(res["variantes"]);
        variantesCell.appendChild(olEl);
        variantesCell.parentNode.classList.remove("gone");
    } else {
        variantesCell.parentNode.classList.add("gone");
    }
    // Remarques
    if ("remarques" in res) {
        // TODO
        //console.log(res["remarques"]);
    }
    // Historique du mot
    if ("historique" in res) {
        if (historiqueCell.firstChild) {
            historiqueCell.removeChild(historiqueCell.firstChild);
        }
        var historiqueUL = document.createElement("ul");
        for (var i=0, historique, historiqueLI; i < res["historique"].length; ++i) {
            historique = res["historique"][i];
            historiqueLI = document.createElement("li");
            historiqueLI.appendChild(document.createTextNode(historique));
            historiqueUL.appendChild(historiqueLI);
        }
        historiqueCell.appendChild(historiqueUL);
        historiqueCell.parentNode.classList.remove("gone");
    } else {
        historiqueCell.parentNode.classList.add("gone");
    }
    showDictionnaryTab();
}

/*
 * TODO
 */

function buildVarianteList(variantes)
{
    var variantesOL = document.createElement("ol");
    for (var i=0, variante, varianteLI, txt; i < variantes.length; ++i) {
        variante = variantes[i];
        varianteLI = document.createElement("li");
        // Place premièrement le nom de la variante, puis ses citations
        varianteLI.appendChild(document.createTextNode(variante["txt"]));
        // Énumération des citations associées à chaque variante
        if ("cit" in variante) {
            var citationsUL = document.createElement("ul");
            for (var j=0, citation, ul, citationLI, u, q; j < variante["cit"].length; ++j) {
                citation = variante["cit"][j];
                citationLI = document.createElement("li");
                u = document.createElement("u");
                q = document.createElement("q");
                citationLI.appendChild(document.createTextNode(citation["aut"] + ", "));
                u.appendChild(document.createTextNode(citation["ref"]));
                citationLI.appendChild(u);
                citationLI.appendChild(document.createTextNode(" : "));
                q.appendChild(document.createTextNode(citation["txt"]));
                citationLI.appendChild(q);
                citationsUL.appendChild(citationLI);
                varianteLI.appendChild(citationsUL);
            }
        }
        variantesOL.appendChild(varianteLI);
    }
    return variantesOL;
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
        "tok": "dictionnary",
        "word": word
    };
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}
