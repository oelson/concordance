
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


/*
 * Fonction de manipulation des réponses du serveur concernant les recherches
 * dans le dictionnaire.
 */

function handleDictionnaryResponse(dom)
{
    var root = dom.documentElement;
    var entries = root.getElementsByTagName("entree"), entry, entryOl, table,
        tbody, corps;
    for (var i=0; i < entries.length; ++i) {
        entry = entries[i];
        table = termeModelTable.cloneNode(true);
        tbody = table.tBodies[0];
        // TODO ajouter un titre de table avec <thead> (sens n°1,2,etc...)
        handleEntete(
            entry.getAttribute("terme"),
            entry.getElementsByTagName("entete")[0],
            tbody
        );
        corps = entry.getElementsByTagName("corps")[0];
        handleVariantes(
            corps.getElementsByTagName("variante"),
            tbody
        );
        // Vide premièrement la section puis ajoute la nouvelle définition
        while (dictionnarySection.firstChild) {
            dictionnarySection.removeChild(dictionnarySection.firstChild);
        }
        dictionnarySection.appendChild(table);
    }
    showDictionnaryTab();
}

/*
 * Effectue une correspondance entre l'entête d'une entrée du XMLittré et une
 * table HTML de présentation, représentée ici par son corps "tbody".
 * Le terme de l'entrée est donné en premier argument (chaîne de car.)
 */

function handleEntete(terme, entete, tbody)
{
    var termeRow  = tbody.getElementsByClassName("terme")[0];
    var natureRow = tbody.getElementsByClassName("nature")[0];
    var prononRow = tbody.getElementsByClassName("prononciation")[0];
    var termeCell = termeRow.getElementsByTagName("td")[1];
    var natureCell = natureRow.getElementsByTagName("td")[1];
    var prononCell = prononRow.getElementsByTagName("td")[1];
    termeCell.appendChild(document.createTextNode(terme));
    prononCell.appendChild(entete.getElementsByTagName("prononciation")[0].firstChild);
    natureCell.appendChild(entete.getElementsByTagName("nature")[0].firstChild);
    termeRow.classList.remove("gone");
    prononRow.classList.remove("gone");
    natureRow.classList.remove("gone");
}

/*
 * Parcours les variantes d'une entrée et les représente au sein d'une table,
 * représentée ici par son corps "tbody".
 */

function handleVariantes(variantes, tbody)
{
    var varRow = tbody.getElementsByClassName("variantes")[0];
    var varCell = varRow.getElementsByTagName("td")[1];
    var variante, olVar = document.createElement("ol"), liDef;
    var label;
    var indentsUl, indentLi;
    for (var i=0; i < variantes.length; ++i) {
        variante = variantes[i];
        liDef = document.createElement("li");

        // Le libellé de la variante peut être contenu dans un ensemble de
        // noeuds et de noeuds texte, situés les uns derrière les autres
        label = getRootText(variante, ["semantique"]);
        liDef.appendChild(document.createTextNode(label));

        // Récupère les indentations
        indentsUl = handleIndents(variante);
        if (indentsUl) {
            liDef.appendChild(indentsUl)
        }

        olVar.appendChild(liDef);
    }
    varCell.appendChild(olVar);
    if (variantes.length > 0) {
        varRow.classList.remove("gone");
    }
}

/*
 * Gestion des "indent", à savoir la structure de la définition
 */

function handleIndents(parent)
{
    var indent;
    var xpr = document.evaluate(
        "./indent",
        parent,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var indentsUl = null, indentLi;
    do {
        indent = xpr.iterateNext();
        if (indent) {
            if (!indentsUl) {
                indentsUl = document.createElement("ul");
            }
            indentLi = document.createElement("li");
            // Obtient uniquement le texte à la racine
            indentLi.appendChild(document.createTextNode(getRootText(indent)));
            indentsUl.appendChild(indentLi)
        }
    }
    while (indent);
    return indentsUl;
}

/*
 * Récupère la concaténation des noeuds texte situés à la racine d'un élément.
 * Conçu pour remplacer "element.textContent", qui est récursif.
 */

function getRootText(element, allowedTags)
{
    var xpathExpr = "./text()";
    // Ajoute une liste de tags à inspécter depuis la racine
    if (allowedTags) {
        xpathExpr = "("+xpathExpr;
        for (var i=0; i < length; ++i) {
            if (i > 0) {
                xpathExpr += "|";
            }
            xpathExpr += "./"+allowedTags[i]+"/text()";
        }
        xpathExpr = xpathExpr+")";
    }
    var xpr = document.evaluate(
        xpathExpr,
        element, 
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var tmp;
    var text = "";
    do {
        tmp = xpr.iterateNext();
        if (tmp) {
            text += tmp.nodeValue.replace(/\n+/g, " ");
        }
    }
    while (tmp);
    return text;
}

/*
 * TODO obsolete
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
 * Représente une citation.
 */

function format_citation(citation)
{
    var p = document.createElement("p");
    var aut = document.createElement("i");
    var ref = document.createElement("u");
    var q = document.createElement("blockquote");
    
    aut.appendChild(document.createTextNode(citation["aut"]));
    ref.appendChild(document.createTextNode(citation["ref"]));
    q.appendChild(document.createTextNode(citation["text"]));
    
    p.appendChild(aut);
    p.appendChild(ref);
    p.appendChild(q);
    
    return p;
}

/*
 * Représente un ensemble de variantes sous la forme d'une liste à puces
 * ordonnée.
 * Retourne la liste à puce.
 */

function format_variantes(variantes)
{
    var ol = document.createElement("ol"), li, v;
    for (var i=0; i < variantes.length; ++i) {
        v = variantes[i];
        li = format_variante(v);
        // le format peut-être récursif
        if ("indent" in v) {
            li.appendChild(format_variantes(v["indent"]));
        }
        ol.appendChild(li);
    }
    return ol;
}

/*
 * Formatte une variante sous la forme d'un élément de list à puce, et le
 * retourne.
 * Éventuellement récursif sur l'attribut "indent".
 */

function format_variante(v)
{
    var li, li_cit;
    li = document.createElement("li")
    li.appendChild(document.createTextNode(v["text"]));
    // citations attachées à une variante
    if ("cit" in v) {
        var ul_cit = document.createElement("ul");
        for (var cit in v["cit"]) {
            li_cit = document.createElement("li");
            li_cit.appendChild(format_citation(cit));
            ul_cit.appendChild(li_cit);
        }
        li.appendChild(ul_cit);
    }
    return li;
}

/*
 * 
 */

function format_synonymes(definition)
{
    // TODO
}

/*
 * 
 */

function format_historique(definition)
{
    // TODO
}

/*
 * 
 */

function format_etymologies(definition)
{
    // TODO
}
