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
        var parser = new DOMParser();
        var dom = parser.parseFromString(resp["res"], "text/xml");
        handleDictionnaryResponse(dom);
        break;
    default:
        console.error("unknown token");
        break;
    }
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
