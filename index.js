const Bacon = require('baconjs');
const osc = require('osc');

const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 57121,

  remoteAddress: "127.0.0.1",
  remotePort: 57120
});

const messages = Bacon.fromEvent(udpPort, "message");

const TRACKS_PER_BANK = 8;

function trackNameResponsesForBank() {
  return messages
    .filter((m) => m.address.indexOf('/1/trackname') === 0)
    .take(TRACKS_PER_BANK)
    .filter((m) => m.args[0] !== 'n.a.')
    .fold([], (names, message) => names.concat(message.args));
}

// TODO only checks first bank
function listTrackNamesForBus(bus) {
  udpPort.send({ address: '/1', args: [1] });
  udpPort.send({ address: '/1/' + bus, args: [1] });
  udpPort.send({ address: '/setBankStart', args: [0] });
  return trackNameResponsesForBank();
}

function listTrackNames() {
  const inputTracks = listTrackNamesForBus('busInput');
  const playbackTracks = inputTracks.flatMap(() => listTrackNamesForBus('busPlayback'));
  const outputTracks = playbackTracks.flatMap(() => listTrackNamesForBus('busOutput'));

  return Bacon.combineTemplate({
    input: inputTracks,
    playback: playbackTracks,
    output: outputTracks
  })
}

udpPort.on("ready", () => {
  function printTracks(group, names) {
    console.log(`  ${group} (${names.length} tracks):`);
    names.forEach(name => console.log(`    ${name}`));
  }

  listTrackNames().onValue(names => {
    console.log('TotalMix tracks are:')
    printTracks('Input', names.input);
    printTracks('Playback', names.playback);
    printTracks('Output', names.output);

    process.exit(0);
  })
});

udpPort.on("error", (err) => console.log(err))

udpPort.open();
