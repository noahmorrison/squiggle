var esprima = require("esprima");
var flatten = require("lodash/array/flatten");
var L = require("lodash");

var es = require("../es");
var ph = require("./pattern-helpers");

function esNot(x) {
    return es.UnaryExpression(null, true, "!", x);
}

function esDeclare(loc, id, expr) {
    return es.VariableDeclaration(loc, "var", [
        es.VariableDeclarator(null, id, expr)
    ]);
}

function bindingToDeclAndInit(transform, b) {
    if (b.identifier.type === "PatternSimple") {
        if (b.identifier.identifier.data === "_") {
            return unboundLetDeclAndInit(transform, b.value);
        } else {
            return simpleBindingToDeclAndInit(transform, b);
        }
    } else {
        return complexBindingToDeclAndInit(transform, b);
    }
}

function unboundLetDeclAndInit(transform, expr) {
    var stmt = es.ExpressionStatement(expr.loc, transform(expr));
    return {
        identifier: null,
        initialization: stmt
    };
}

function simpleBindingToDeclAndInit(transform, b) {
    var ident = transform(b.identifier.identifier);
    var expr = transform(b.value);
    var assignExpr = es.AssignmentExpression(null, "=", ident, expr);
    var assignStmt = es.ExpressionStatement(null, assignExpr);
    return {
        identifier: ident,
        initialization: assignStmt
    };
}

function complexBindingToDeclAndInit(transform, b) {
    var throwUp =
        esprima.parse("throw new Error('destructuring failure');").body;
    var value = transform(b.value);
    var root = tmp;
    var pattern = b.identifier;
    var looksGood =
        ph.satisfiesPattern(transform, root, pattern);
    var theCheck =
        es.IfStatement(
            null,
            esNot(looksGood),
            es.BlockStatement(null, throwUp),
            null
        );
    var assignTmp = es.ExpressionStatement(
        null,
        es.AssignmentExpression(
            null,
            "=",
            tmp,
            value
        )
    );
    var matchy = [
        assignTmp,
        theCheck
    ];
    var pluck = ph.pluckPattern(transform, root, pattern);
    var pairs = L.zip(pluck.identifiers, pluck.expressions);
    var assignments = pairs.map(function(x) {
        var id = x[0];
        var expr = x[1];
        var assign = es.AssignmentExpression(id.loc, "=", id, expr);
        return es.ExpressionStatement(id.loc, assign);
    });
    return {
        identifier: L.map(pairs, 0),
        initialization: matchy.concat(assignments)
    };
}

var undef = es.Identifier(null, "$undef");
var tmp = es.Identifier(null, "$tmp");

function Let(transform, node) {
    var allBindings =
        L.map(node.bindings, bindingToDeclAndInit.bind(null, transform));
    var allIdents = L(allBindings)
        .map("identifier")
        .compact()
        .flatten()
        .value();
    // TODO: Check for duplicates in allIdents.
    var declarations = L.map(allIdents, function(id) {
        return esDeclare(null, id, undef);
    });
    var initializations = L(allBindings)
        .map("initialization")
        .flatten()
        .value();
    var e = transform(node.expr);
    var returnExpr = es.ReturnStatement(node.expr.loc, e);
    var body = flatten([
        esDeclare(null, tmp, null),
        declarations,
        initializations,
        returnExpr
    ]);
    var block = es.BlockStatement(null, body);
    var fn = es.FunctionExpression(null, null, [], block);
    return es.CallExpression(null, fn, []);
}

module.exports = Let;
