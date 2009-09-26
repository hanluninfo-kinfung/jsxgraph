/*
    Copyright 2008,2009
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.

    JSXGraph is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    JSXGraph is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with JSXGraph. If not, see <http://www.gnu.org/licenses/>.
*/

/** 
 * @fileoverview The JXG.Server is a wrapper for a smoother integration of server side calculations. on the
 * server side a python plugin system is used.
 */

/** TODO: Documentation */

JXG.Server = function(){};

JXG.Server.modules = function(){};

JXG.Server.runningCalls = {};

JXG.Server.handleError = function(data) {
	alert('error occured, server says: ' + data.message);
};

JXG.Server.callServer = function(action, callback, data, sync) {
	var fileurl, passdata,
	params, id, dataJSONStr,
	k;

    if(typeof sync == 'undefined' || sync == null)
        sync = false;

	params = '';
	for(k in data) {
		params += '&' + escape(k) + '=' + escape(data[k]);
	}

	dataJSONStr = JXG.toJSON(data);

	// generate id
	do {
		id = action + Math.floor(Math.random()*4096);
	} while(typeof this.runningCalls[id] != 'undefined');

	// store information about the calls
	this.runningCalls[id] = { 'action': action };
	if(typeof data.module != 'undefined')
		this.runningCalls[id].module = data.module;

	fileurl = JXG.serverBase + 'JXGServer.py';
    passdata = 'action=' + escape(action) + '&id=' + id + '&dataJSON=' + escape(JXG.Util.Base64.encode(dataJSONStr));

	this.cbp = function(d) {
		var str, data,
		tmp, inject, paramlist, id,
		i, j;

		str = (new JXG.Util.Unzip(JXG.Util.Base64.decodeAsArray(d))).unzip();
		if(JXG.isArray(str) && str.length > 0)
			str = str[0][0];

        if(typeof str != 'string')
            return;

		data =  eval("(" + str + ")");

		if(data.type == 'error') {
			handleError(data);
		} else if (data.type == 'response') {
			id = data.id;

			// inject fields
			for(i=0; i<data.fields.length; i++) {
				tmp = data.fields[i];
				inject = tmp.namespace + ( typeof eval(tmp.namespace) == 'object' ? '.' : '.prototype.') + tmp.name + ' = ' + tmp.value;
				eval(inject);
			}

			// inject handlers
			for(i=0; i<data.fields.length; i++) {
				tmp = data.handler[i];
				paramlist = [];
				for(j=0; j<tmp.parameters.length; j++) {
					paramlist[j] = '"' + tmp.parameters[j] + '": ' + tmp.parameters[j];
				}
				// insert subnamespace named after module.
				inject = 'if(typeof JXG.Server.modules.' + this.runningCalls[id].module + ' == "undefined")' +
				'JXG.Server.modules.' + this.runningCalls[id].module + ' = function(){};';

				// insert callback method which fetches and uses the server's data for calculation in JavaScript
				inject += 'JXG.Server.modules.' + this.runningCalls[id].module + '.' + tmp.name + '_cb = ' + tmp.callback + ';';

				// insert handler as JXG.Server.modules.<module name>.<handler name>
				inject += 'JXG.Server.modules.' + this.runningCalls[id].module + '.' + tmp.name + ' = function (' + tmp.parameters.join(',') + ') {' +
				'var par;' +
				'par = {' + paramlist.join(',') + ', "module": "' + this.runningCalls[id].module + '", "handler": "' + tmp.name + '" };' +
				'JXG.Server.callServer("exec", JXG.Server.modules.' + this.runningCalls[id].module + '.' + tmp.name + '_cb, par);' +
				'};';
				eval(inject);
			}

			delete this.runningCalls[id];

			// handle data
			callback(data.data);
		}
	};

	// bind cbp callback method to JXG.Server to get access to JXG.Server fields from within cpb
	this.cb = JXG.bind(this.cbp, this);

    // we're using our own XMLHttpRequest object in here because of a/sync and POST
    if (window.XMLHttpRequest) {
        AJAX = new XMLHttpRequest();
        AJAX.overrideMimeType('text/plain; charset=iso-8859-1');
    } else {                                  
        AJAX = new ActiveXObject("Microsoft.XMLHTTP");
    }
    if (AJAX) {
        // POST is required if data sent to server is too long for a url.
        // some browsers/http servers don't accept long urls.
        AJAX.open("POST", fileurl, !sync);
        AJAX.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

        if(!sync) {
            // Define function to fetch data received from server
            // that function returning a function is required to make this.cb known to the function.
            AJAX.onreadystatechange = (function(cb){ return function () {
                switch(AJAX.readyState) {
                    // server is ready for take-off
                    case 4:
                        if(AJAX.status != 200)
                            alert("Fehler:" + AJAX.status);
                        else  // grab it and call the server callback to debase64, unzip, and parse the data
                            cb(AJAX.responseText);
                    break;
                    default:
                        return false;
                    break;
                }
            }})(this.cb);
        }

        // send the data
        AJAX.send(passdata);
        if(sync)
            this.cb(AJAX.responseText);
    } else {
        return false;
    }

//	JXG.FileReader.parseFileContent(fileurl, this.cb, 'raw', !sync);
};

JXG.Server.loadModule_cb = function(data) {
	var i;
	for(i=0; i<data.length; i++)
		alert(data[i].name + ': ' + data[i].value);
};

JXG.Server.loadModule = function(module) {
	JXG.Server.callServer('load', JXG.Server.loadModule_cb, {'module': module}, true);
};

