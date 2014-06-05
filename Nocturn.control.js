loadAPI(1);

host.defineController("Novation", "Nocturn Keyboard", "1.0", "76E16CA2-5FCB-4DD1-8940-3B04DD4841BB");
host.defineMidiPorts(1, 1);
host.addDeviceNameBasedDiscoveryPair(["Nocturn Keyboard"], ["Nocturn Keyboard"]);
for ( var i = 1; i < 9; i++)
{
	var name = i.toString() + "- Impulse";
	host.addDeviceNameBasedDiscoveryPair([name], [name]);
	host.addDeviceNameBasedDiscoveryPair(["Impulse MIDI " + i.toString()], ["Impulse MIDI " + i.toString()]);
}

var CC =
{
	PLAY : 30,
	STOP : 29,
	RECORD : 32,
	REWIND : 27,
	FORWARD : 28,
	LOOP : 31,
	PAGE_UP : 11,
	PAGE_DOWN : 12,
	SLIDER : 8,
	MIXER : 9,
	PLUGIN : 10,
	MIDI : 11,
	NEXT_TRACK : 37,
	PREV_TRACK : 38,
	SHIFT : 39
};

var NOTE =
{
	PAD1 : 67,
	PAD2 : 69,
	PAD3 : 71,
	PAD4 : 72,
	PAD5 : 60,
	PAD6 : 62,
	PAD7 : 64,
	PAD8 : 65
};

var CLIP =
{
	PAD1 : 60,
	PAD2 : 61,
	PAD3 : 62,
	PAD4 : 63,
	PAD5 : 64,
	PAD6 : 65,
	PAD7 : 66,
	PAD8 : 67
};

var PAD =
{
	P1 : 40,
	P2 : 41,
	P3 : 42,
	P4 : 43,
	P5 : 36,
	P6 : 37,
	P7 : 38,
	P8 : 39
}

var color =
{
	YELLOW : 55,
	LIGHT_GREEN : 49,
	FULL_GREEN : 48,
	DARK_GREEN : 84,
	ORANGE : 87,
	RED : 67,
	RED_BLINK : 74,
	OFF : 64
};

var SYSEX_HEADER = "F0 00 20 29 67";
var NUM_COLUMS = 8;
var isShiftPressed = false;
var isPlay = false;
var isLoopPressed = false;

var isPlaying = initArray(0, 8);
var isQueued = initArray(0, 8);
var isRecording = initArray(0, 8);
var hasContent = initArray(0, 8);
var arm = initArray(0, 2);
var macroIndex = 0;
var playPads = 145;
var padShift = 0;

function init()
{
	host.getMidiInPort(0).setMidiCallback(onMidi);
	host.getMidiInPort(0).setSysexCallback(onSysex);
	// host.getMidiInPort(0).createNoteInput("Impulse Keyboard", "80????", "90????", "B001??", "B040??", "D0????", "E0????"); // "B040??"-> stops the 5th pad to work
	host.getMidiInPort(0).createNoteInput("Impulse Keyboard", "80????", "90????", "B001??", "D0????", "E0????");
	// host.getMidiInPort(0).createNoteInput("Impulse Pads", "81????", "91????", "D1????", "E1????");
	sendSysex(SYSEX_HEADER + "06 01 01 01 F7");
	// sendSysex(SYSEX_HEADER + "08" + "20 62 69 74 77 69 67 20 20 F7"); //bitwig string to display
	sendSysex(SYSEX_HEADER + "07 19 F7");
	sendChannelController(60, 48 + 5, 0);
	sendChannelController(0xb1, 10, 127);
	// sendSysex("F0 00 20 29 67 08 31 2D 41 75 64 69 6F 20 20 20 20 20 20 20 20 20 F7"); // displaytest?

	// /////////// Host
	transport = host.createTransportSection();
	transport.addIsPlayingObserver(function(on)
	{
		isPlay = on;
	});

	trackBank = host.createTrackBankSection(8, 2, 0);
	cursorTrack = host.createCursorTrackSection(2, 0);
	cursorDevice = host.createCursorDeviceSection(8);
	clipGrid = host.createTrackBankSection(2, 0, 4);
	primaryInstrument = cursorTrack.getPrimaryInstrument();

	for ( var p = 0; p < 8; p++)
	{
		var parameter = cursorDevice.getParameter(p);
		macro = primaryInstrument.getMacro(p);
		macro.getAmount().setIndication(true);
		// macro.addValueDisplayObserver(10, "", pluginPage.getPathToObject.setter(p));
		// macro.addValueObserver(128, pluginPage.getPathToObject.setter(p));
		parameter.setLabel("P" + (p + 1));

		// macro.addLabelObserver(8, "", getObserverIndex(p, function(index, text)
		// {
		// pluginPage.macroLabelBuffer(index, text);
		// }));
		macro.getAmount().addValueDisplayObserver(3, "", getObserverIndex(p, function(index, value)
		{
			// macroIndex = index;
			// println(macroIndex);
			pluginPage.valueToDisplay(value);
			// pluginPage.sendToDisplay();
		}));
		// trackBank.getTrack(p).getVolume().addValueDisplayObserver(4, "", getObserverIndex(p, function(index, value)
		// {
		// sendSysex(SYSEX_HEADER + "08" + "Volume ".toHex(7) + uint7ToHex(index + 49) + " F7");
		// sendSysex(SYSEX_HEADER + "09" + value.toHex(4) + " F7");
		// }));
		// trackBank.getTrack(p).getPan().addValueDisplayObserver(4, "", getObserverIndex(p, function(index, value)
		// {
		// sendSysex(SYSEX_HEADER + "08" + "Pan ".toHex(4) + uint7ToHex(index + 49) + " F7");
		// sendSysex(SYSEX_HEADER + "09" + value.toHex(4) + "25 F7");
		// }));
	}

	for ( var t = 0; t < 2; t++)
	{
		var grid = clipGrid.getTrack(t);
		var clipLauncher = grid.getClipLauncher();
		clipLauncher.addHasContentObserver(getGridObserverFunc(t, hasContent));
		clipLauncher.addIsPlayingObserver(getGridObserverFunc(t, isPlaying));
		clipLauncher.addIsQueuedObserver(getGridObserverFunc(t, isQueued));
		clipLauncher.addIsRecordingObserver(getGridObserverFunc(t, isRecording));
	}
	cursorTrack.addNameObserver(16, "", function(text)
	{
		sendSysex(SYSEX_HEADER + "08" + text.toHex(text.length) + " F7");
	});
	// cursorTrack.getVolume().addValueDisplayObserver(3, "", valueToDisplay(value));
	initImpulse();

}

function exit()
{
}

function onMidi(status, data1, data2)
{
//	printMidi(status, data1, data2);
	if (isNoteOn(status))
	{
		if (status == playPads && data2 > 0)
		{
			if (data1 >= NOTE.PAD5 && data1 <= NOTE.PAD4)
			{
				switch (data1)
				{
					case NOTE.PAD1:
						cursorTrack.playNote(PAD.P1 + padShift, data2);
						break;
					case NOTE.PAD2:
						cursorTrack.playNote(PAD.P2 + padShift, data2);
						break;
					case NOTE.PAD3:
						cursorTrack.playNote(PAD.P3 + padShift, data2);
						break;
					case NOTE.PAD4:
						cursorTrack.playNote(PAD.P4 + padShift, data2);
						break;
					case NOTE.PAD5:
						cursorTrack.playNote(PAD.P5 + padShift, data2);
						break;
					case NOTE.PAD6:
						cursorTrack.playNote(PAD.P6 + padShift, data2);
						break;
					case NOTE.PAD7:
						cursorTrack.playNote(PAD.P7 + padShift, data2);
						break;
					case NOTE.PAD8:
						cursorTrack.playNote(PAD.P8 + padShift, data2);
						break;
				}
			}
		}
	}
	if (isChannelController(status))
	{
		if (status == 0xb1)
		{

			if (data1 >= 0 && data1 <= 7) // Rotary Encoders
			{
				var relativeRange = isLoopPressed ? 500 : 100;
				var encoderId = data1;
				impulseActiveEncoderPage.onEncoder(encoderId, data2 - 64, relativeRange);

			}
			else if (data1 == CC.PLUGIN)
			{
				setEncoderMode(pluginPage);
			}
			else if (data1 == CC.MIXER)
			{
				setEncoderMode(mixerPage);
			}
			if (data1 == CC.PAGE_UP)
			{
				isShiftPressed = false;
				impulseActiveEncoderPage.setIndications("notpressed");
				impulseActiveEncoderPage.pageUp();
			}
			if (data1 == CC.PAGE_DOWN)
			{
				isShiftPressed = false;
				impulseActiveEncoderPage.setIndications("notpressed");
				impulseActiveEncoderPage.pageDown();
			}

		}
		if (status == 0xb0)
		{
			var cc = data1;
			var val = data2;
			var pressed = cc - CLIP.PAD1;
			if (cc >= CLIP.PAD1 && cc < CLIP.PAD1 + 4)
			{
				isLoopPressed ? clipGrid.launchScene(pressed) : clipGrid.getTrack(0).getClipLauncher().launch(pressed);
			}
			else if (cc >= CLIP.PAD1 + 4 && cc < CLIP.PAD1 + 8)
			{
				isLoopPressed ? clipGrid.launchScene(pressed - 4) : clipGrid.getTrack(1).getClipLauncher().launch(pressed - 4);
			}

			switch (cc)
			{
				case CC.SLIDER:
					cursorTrack.getVolume().set(val, 128);
					break;
				case CC.SHIFT:
					isShiftPressed = val > 0;
					isShiftPressed ? impulseActiveEncoderPage.setIndications("pressed") : impulseActiveEncoderPage.setIndications("notpressed");
					break;
				case CC.LOOP:
					isLoopPressed = val > 0;

					if (isShiftPressed && isLoopPressed) transport.toggleLoop();
					break;
			}

			if (val > 0) // ignore button release
			{
				switch (cc)
				{
					case CC.PLAY:
						isLoopPressed ? transport.returnToArrangerment() : transport.play();
						break;

					case CC.STOP:
						isLoopPressed ? transport.resetAutomationOverrides() : transport.stop();
						break;

					case CC.RECORD:
						isLoopPressed ? cursorTrack.getArm().toggle() : transport.record();
						break;

					case CC.REWIND:
						impulseActiveEncoderPage.rewindAction();
						break;

					case CC.FORWARD:
						impulseActiveEncoderPage.forwardAction();
						break;

					case CC.PREV_TRACK:
						isShiftPressed = false;
						impulseActiveEncoderPage.setIndications("notpressed");
						cursorTrack.selectPrevious();
						break;

					case CC.NEXT_TRACK:
						isShiftPressed = false;
						impulseActiveEncoderPage.setIndications("notpressed");
						cursorTrack.selectNext();
						break;
				}
			}
		}
	}

}

function onSysex(data)
{
	// printSysex(data);
}

function EncoderObject()
{
	this.textBuffer = [];

	for ( var i = 0; i < NUM_COLUMS; i++)
	{
		this.textBuffer[i] = ' ';
	}
}

EncoderObject.prototype.onEncoder = function(index, diff, range)
{
	this.getPathToObject(index).inc(diff, range);
};

// EncoderObject.prototype.setter = function(index)
// {
// var obj = this;
//
// return function(data)
// {
// obj.set(index, data);
// }
// };

var pluginPage = new EncoderObject();

pluginPage.getPathToObject = function(index)
{
	return isShiftPressed ? cursorDevice.getParameter(index) : primaryInstrument.getMacro(index).getAmount();
};

pluginPage.rewindAction = function()
{
	isShiftPressed ? cursorDevice.previousParameterPage() : isLoopPressed ? clipGrid.scrollTracksUp() : clipGrid.scrollScenesUp();
}

pluginPage.forwardAction = function()
{
	isShiftPressed ? cursorDevice.nextParameterPage() : isLoopPressed ? clipGrid.scrollTracksDown() : clipGrid.scrollScenesDown();
}
pluginPage.pageUp = function()
{
	cursorDevice.selectPrevious();
}

pluginPage.pageDown = function()
{
	cursorDevice.selectNext();
}

pluginPage.setIndications = function(isShift)
{
	switch (isShift)
	{
		case "pressed":
			for ( var p = 0; p < 8; p++)
			{
				macro = primaryInstrument.getMacro(p).getAmount();
				track = trackBank.getTrack(p);
				cursorDevice.getParameter(p).setIndication(true);
				macro.setIndication(false);
				track.getVolume().setIndication(false);
				track.getPan().setIndication(false);
			}
			break;
		case "notpressed":
			for ( var p = 0; p < 8; p++)
			{
				macro = primaryInstrument.getMacro(p).getAmount();
				track = trackBank.getTrack(p);
				cursorDevice.getParameter(p).setIndication(false);
				macro.setIndication(true);
				track.getVolume().setIndication(false);
				track.getPan().setIndication(false);
			}
			break;
		default:
			break;
	}
}

// //////////////////// work in progress ///////////////////////
pluginPage.macroLabelBuffer = function(index, text)
{
	var param = index * NUM_COLUMS;
	var forcedText = text.forceLength(NUM_COLUMS);
	for ( var i = 0; i < NUM_COLUMS; i++)
	{
		this.textBuffer[i + param] = forcedText[i];
	}
	pluginPage.sendToDisplay();
}
pluginPage.sendToDisplay = function()
{
	{
		var tb = macroIndex * NUM_COLUMS;
		var text = "";

		for ( var i = 0; i < NUM_COLUMS; i++)
		{
			text += this.textBuffer[tb + i];
		}
		sendSysex(SYSEX_HEADER + "08" + this.textBuffer[text].toHex(NUM_COLUMS) + "F7");
	}
	;
}

pluginPage.valueToDisplay = function(value)
{
	if (parseInt(value) < 10)
	{
		sendSysex(SYSEX_HEADER + "09 20 20" + value.toHex(1) + "F7");
	}
	else if (parseInt(value) >= 10 && parseInt(value) < 100)
	{
		sendSysex(SYSEX_HEADER + "09 20" + value.toHex(2) + "F7");
	}
	else
	{
		sendSysex(SYSEX_HEADER + "09" + value.toHex(3) + "F7");
	}
}
// ///////////////////////////////////////////////////////////////////

var mixerPage = new EncoderObject();

mixerPage.getPathToObject = function(index)
{
	if (isShiftPressed)
	{
		return trackBank.getTrack(index).getPan();
	}
	else
	{
		return trackBank.getTrack(index).getVolume();
	}
};

mixerPage.rewindAction = function()
{
	isShiftPressed ? transport.rewind() : isLoopPressed ? clipGrid.scrollTracksUp() : clipGrid.scrollScenesUp();
}

mixerPage.forwardAction = function()
{
	isShiftPressed ? transport.fastForward() : isLoopPressed ? clipGrid.scrollTracksDown() : clipGrid.scrollScenesDown();
}

mixerPage.pageUp = function()
{
	trackBank.scrollTracksPageUp();

}

mixerPage.pageDown = function()
{
	trackBank.scrollTracksPageDown();

}
mixerPage.setIndications = function(isShift)
{
	switch (isShift)
	{
		case "pressed":
			for ( var p = 0; p < 8; p++)
			{
				macro = primaryInstrument.getMacro(p).getAmount();
				track = trackBank.getTrack(p);
				track.getVolume().setIndication(false);
				track.getPan().setIndication(true);
				macro.setIndication(false);
				cursorDevice.getParameter(p).setIndication(false);
			}
			break;
		case "notpressed":
			for ( var p = 0; p < 8; p++)
			{
				macro = primaryInstrument.getMacro(p).getAmount();
				track = trackBank.getTrack(p);
				track.getVolume().setIndication(true);
				track.getPan().setIndication(false);
				macro.setIndication(false);
				cursorDevice.getParameter(p).setIndication(false);
			}
			break;
		default:
			break;
	}

}

var impulseActiveEncoderPage = pluginPage;

function setEncoderMode(page)
{
	impulseActiveEncoderPage = page;
	impulseActiveEncoderPage.setIndications("notpressed");
}
function valueToDisplay(value)
{
	if (parseInt(value) < 10)
	{
		sendSysex(SYSEX_HEADER + "09 20 20" + value.toHex(1) + "F7");
	}
	else if (parseInt(value) >= 10 && parseInt(value) < 100)
	{
		sendSysex(SYSEX_HEADER + "09 20" + value.toHex(2) + "F7");
	}
	else
	{
		sendSysex(SYSEX_HEADER + "09" + value.toHex(3) + "F7");
	}
}

function getObserverIndex(index, f)
{
	macroIndex = index;
	return function(value)
	{
		f(index, value);
	};
}

function getGridObserverFunc(track, varToStore)
{
	return function(scene, value)
	{
		var index = track * 4 + (scene + 1);
		varToStore[index] = value;
		var state = isRecording[index] ? color.RED : isPlaying[index] ? color.FULL_GREEN : isQueued[index] ? color.LIGHT_GREEN : hasContent[index] ? color.YELLOW : arm[track] ? color.ORANGE : color.OFF;
		setClipGridLEDs(index, state);
		// gridPage.updateTrackValue(track);
	};
}

function setClipGridLEDs(button, state)
{
	sendNoteOn(0xB0, 59 + button, state);
}

function initImpulse()
{
	impulseActiveEncoderPage.setIndications("notpressed");
}

// ////////// not used since using native mode
// sendSysex ("F0 00 20 29 43 00 00 42 61 73 63 4D 49 44 49 00 03 02 01 3C
// 0B 00 24 3B 40 00 00 3C 60 40 01 00 24 54 40 10 04 24 54 40 10 04 09 15
// 7F 00 10 08 01 09 16 7F 00 10 08 01 09 17 7F 00 10 08 01 09 18 7F 00 10
// 08 01 09 19 7F 00 10 08 01 09 1A 7F 00 10 08 01 09 1B 7F 00 10 08 01 09
// 1C 7F 00 10 08 01 08 43 7F 00 01 08 01 08 45 7F 00 01 08 01 08 47 7F 00
// 01 08 01 08 48 7F 00 01 08 01 08 3C 7F 00 01 08 01 08 3E 7F 00 01 08 01
// 08 40 7F 00 01 08 01 08 41 7F 00 01 08 01 09 29 7F 00 10 08 01 09 2A 7F
// 00 10 08 01 09 2B 7F 00 10 08 01 09 2C 7F 00 10 08 01 09 2D 7F 00 10 08
// 01 09 2E 7F 00 10 08 01 09 2F 7F 00 10 08 01 09 30 7F 00 10 08 01 09 31
// 7F 00 10 08 01 11 33 7F 00 10 08 01 11 34 7F 00 10 08 01 11 35 7F 00 10
// 08 01 11 36 7F 00 10 08 01 11 37 7F 00 10 08 01 11 38 7F 00 10 08 01 11
// 39 7F 00 10 08 01 11 3A 7F 00 10 08 01 11 3B 7F 00 10 08 01 09 01 7F 00
// 10 08 01 F7");
