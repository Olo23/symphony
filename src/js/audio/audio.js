'use strict'

import * as THREE from 'three'
import Config from '../Config'
import Tone from 'tone'
import _ from 'lodash'
import { map } from '../../utils/math'

export default class Audio {
  constructor (camera) {
    this.camera = camera
    this.loops = []
    this.quantize = 32
    this.masterVol = -18 // db
    this.ambienceVol = -15 // db
    this.ambiencePath = Config.assetPath + 'sounds/ambience/mining.ogg'
    this.bpm = 60
    this.notes = {
      55.000: 'A1',
      58.270: 'A#1',
      61.735: 'B1',
      65.406: 'C1',
      69.296: 'C#1',
      73.416: 'D1',
      77.782: 'D#1',
      82.407: 'E1',
      87.307: 'F1',
      92.499: 'F#1',
      97.999: 'G1',
      103.826: 'G#1',
      110.000: 'A2',
      116.541: 'A#2',
      123.471: 'B2',
      130.813: 'C2',
      138.591: 'C#2',
      146.832: 'D2',
      155.563: 'D#2',
      164.814: 'E2',
      174.614: 'F2',
      184.997: 'F#2',
      195.998: 'G2',
      207.652: 'G#2',
      220.000: 'A3',
      233.082: 'A#3',
      246.942: 'B3',
      261.626: 'C3',
      277.183: 'C#3',
      293.665: 'D3',
      311.127: 'D#3',
      329.628: 'E3',
      349.228: 'F3',
      369.994: 'F#3',
      391.995: 'G3',
      415.305: 'G#3',
      440.000: 'A4',
      466.164: 'A#4',
      493.883: 'B4',
      523.251: 'C4'
    }

    this.pointColors = []

    this.modes = {
      'ionian': [
        'C',
        'D',
        'E',
        'F',
        'G',
        'A',
        'B',
        'C'
      ],
      'dorian': [
        'C',
        'D',
        'D#',
        'F',
        'G',
        'A',
        'A#',
        'C'
      ],
      'phrygian': [
        'C',
        'C#',
        'D#',
        'F',
        'G',
        'G#',
        'A#',
        'C'
      ],
      'lydian': [
        'C',
        'D',
        'E',
        'F#',
        'G',
        'A',
        'B',
        'C'
      ],
      'mixolydian': [
        'C',
        'D',
        'E',
        'F',
        'G',
        'A',
        'A#',
        'C'
      ],
      'aeolian': [
        'C',
        'D',
        'D#',
        'F',
        'G',
        'G#',
        'A#',
        'C'
      ],
      'locrian': [
        'C',
        'C#',
        'D#',
        'F',
        'F#',
        'G#',
        'A#',
        'C'
      ]
    }

    this.audioLoader = new THREE.AudioLoader()
  }

  playAmbience () {
    return new Promise((resolve, reject) => {
      this.ambienceFilter = new Tone.Filter({
        type: 'lowpass',
        Q: 5
      }).chain(this.ambienceBus)

      this.ambiencePlayer = new Tone.Player({
        'url': this.ambiencePath,
        'loop': true,
        onload: () => {
          resolve()
        }
      // }).chain(this.ambienceFilter)
      }).chain(this.ambienceBus)

      this.ambienceBus.volume.linearRampToValueAtTime(this.ambienceVol, 20)
    })
  }

  setAmbienceFilterCutoff (value) {
    // this.ambienceFilter.frequency.linearRampToValueAtTime(value, Tone.Transport.seconds + 5)
  }

  unloadSound () {
    if (this.loops.length) {
      for (let index = 0; index < this.loops.length; index++) {
        const loop = this.loops[index]
        loop.cancel()
        loop.dispose()
      }
      this.loops = []
    }
  }

  preloadNotes () {
    return new Promise((resolve, reject) => {
      let loadCount = 0
      let self = this
      resolve()
      _.forIn(this.notes, (note, key) => {
        this.audioLoader.load(
          // resource URL
          Config.assetPath + 'sounds/kalimba/' + note.replace('#', 'S') + '.mp3',
          // Function when resource is loaded
          function (audioBuffer) {
            loadCount++
            if (loadCount === Object.keys(self.notes).length) {
              resolve()
            }
          }
        )
      })
    })
  }

  preloadAmbience () {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        this.ambiencePath,
        function (audioBuffer) {
          resolve()
        }
      )
    })
  }

  preload () {
    return new Promise((resolve, reject) => {
      this.preloadNotes().then(() => {
        this.preloadAmbience().then(() => {
          console.log('sound loaded')
          resolve()
        })
      })
    })
  }

  init () {
    return new Promise((resolve, reject) => {
      this.masterBus = new Tone.Volume(this.masterVol).toMaster()
      this.ambienceBus = new Tone.Volume(-96).toMaster()

      this.convolver = new Tone.Convolver(Config.assetPath + 'sounds/IR/r1_ortf.wav')
      this.convolver.set('wet', 1.0)

      this.pingPong = new Tone.PingPongDelay('16n', 0.85)

      Tone.Transport.bpm.value = this.bpm

      Tone.Listener.setPosition(this.camera.position.x, this.camera.position.y, this.camera.position.z)

      document.addEventListener('cameraMove', function () {
        Tone.Listener.setPosition(this.camera.position.x, this.camera.position.y, this.camera.position.z)
      }.bind(this), false)

      let cameraForwardVector = new THREE.Vector3()
      let quaternion = new THREE.Quaternion()
      cameraForwardVector.set(0, 0, -1).applyQuaternion(quaternion)

      Tone.Listener.setOrientation(cameraForwardVector.x, cameraForwardVector.y, cameraForwardVector.z, this.camera.up.x, this.camera.up.y, this.camera.up.z)

      this.sampler = new Tone.Sampler({
        'A1': Config.assetPath + 'sounds/kalimba/A1.mp3',
        'A#1': Config.assetPath + 'sounds/kalimba/AS1.mp3',
        'B1': Config.assetPath + 'sounds/kalimba/B1.mp3',
        'C1': Config.assetPath + 'sounds/kalimba/C1.mp3',
        'C#1': Config.assetPath + 'sounds/kalimba/CS1.mp3',
        'D1': Config.assetPath + 'sounds/kalimba/D1.mp3',
        'D#1': Config.assetPath + 'sounds/kalimba/DS1.mp3',
        'E1': Config.assetPath + 'sounds/kalimba/E1.mp3',
        'F1': Config.assetPath + 'sounds/kalimba/F1.mp3',
        'F#1': Config.assetPath + 'sounds/kalimba/FS1.mp3',
        'G1': Config.assetPath + 'sounds/kalimba/G1.mp3',
        'G#1': Config.assetPath + 'sounds/kalimba/GS1.mp3',
        'A2': Config.assetPath + 'sounds/kalimba/A2.mp3',
        'A#2': Config.assetPath + 'sounds/kalimba/AS2.mp3',
        'B2': Config.assetPath + 'sounds/kalimba/B2.mp3',
        'C2': Config.assetPath + 'sounds/kalimba/C2.mp3',
        'C#2': Config.assetPath + 'sounds/kalimba/CS2.mp3',
        'D2': Config.assetPath + 'sounds/kalimba/D2.mp3',
        'D#2': Config.assetPath + 'sounds/kalimba/DS2.mp3',
        'E2': Config.assetPath + 'sounds/kalimba/E2.mp3',
        'F2': Config.assetPath + 'sounds/kalimba/F2.mp3',
        'F#2': Config.assetPath + 'sounds/kalimba/FS2.mp3',
        'G2': Config.assetPath + 'sounds/kalimba/G2.mp3',
        'G#2': Config.assetPath + 'sounds/kalimba/GS2.mp3',
        'A3': Config.assetPath + 'sounds/kalimba/A3.mp3',
        'A#3': Config.assetPath + 'sounds/kalimba/AS3.mp3',
        'B3': Config.assetPath + 'sounds/kalimba/B3.mp3',
        'C3': Config.assetPath + 'sounds/kalimba/C3.mp3',
        'C#3': Config.assetPath + 'sounds/kalimba/CS3.mp3',
        'D3': Config.assetPath + 'sounds/kalimba/D3.mp3',
        'D#3': Config.assetPath + 'sounds/kalimba/DS3.mp3',
        'E3': Config.assetPath + 'sounds/kalimba/E3.mp3',
        'F3': Config.assetPath + 'sounds/kalimba/F3.mp3',
        'F#3': Config.assetPath + 'sounds/kalimba/FS3.mp3',
        'G3': Config.assetPath + 'sounds/kalimba/G3.mp3',
        'G#3': Config.assetPath + 'sounds/kalimba/GS3.mp3'
    /*    'A4': Config.assetPath + 'sounds/kalimba/A4.mp3',
        'A#4': Config.assetPath + 'sounds/kalimba/AS4.mp3',
        'B4': Config.assetPath + 'sounds/kalimba/B4.mp3',
        'C4': Config.assetPath + 'sounds/kalimba/C4.mp3' */
      }).chain(this.masterBus)

      this.preload().then(() => {
        this.playAmbience().then(() => {
          this.ambiencePlayer.start()
          Tone.Transport.start()
          resolve()
        })
      })
    })
  }

  generateMerkleSound (positionsArray, blockObjectPosition, block, pointsMaterial, pointsMesh) {
    let noteTotal = 2000
    let noteCount = 0

    this.loopMap = []

    this.black = new THREE.Color(0x000000)
    this.white = new THREE.Color(0xffffff)

    this.pointsMaterial = pointsMaterial

    let minTime = Number.MAX_SAFE_INTEGER
    let maxTime = 0

    for (let index = 0; index < block.transactions.length; index++) {
      const transaction = block.transactions[index]
      minTime = Math.min(transaction.time, minTime)
      maxTime = Math.max(transaction.time, maxTime)
    }

    block.transactions.sort((a, b) => {
      return a.time > b.time
    })

    this.pointColors = []
    for (let index = 0; index < positionsArray.length * 3; index++) {
      this.pointColors.push(0)
    }

    for (let index = 0; index < positionsArray.length; index++) {
      const point = positionsArray[index]

      /**
       * Map transaction time to new range
       */
      if (typeof block.transactions[index] !== 'undefined') {
        const transaction = block.transactions[index]
        let time = map(transaction.time, minTime, maxTime, 0, 30) + 1.0

        // noteCount++

        // get closest note
        let minDiff = Number.MAX_SAFE_INTEGER
        let note = 'C1'

        let mode = this.modes.aeolian
        for (var frequency in this.notes) {
          if (this.notes.hasOwnProperty(frequency)) {
            let noteName = this.notes[frequency].replace(/[0-9]/g, '')
            if (mode.indexOf(noteName) !== -1) { // filter out notes not in mode
              let diff = Math.abs((point.y * 1.2) - frequency)
              if (diff < minDiff) {
                minDiff = diff
                note = this.notes[frequency]
              }
            }
          }
        }

        let that = this
        let loop

        let timeLowRes = time.toFixed(1)

        if (typeof this.loopMap[timeLowRes] === 'undefined') {
          loop = new Tone.Loop(
            () => {
              this.sampler.triggerAttack(note, '@' + that.quantize + 'n', 1.0)
              this.pointColors[index * 3] = 255
              setTimeout(() => {
                this.pointColors[index * 3] = 0
              }, 500)
            },
            '1m'
          ).start(Tone.Transport.seconds + time)
        } else {
          loop = new Tone.Loop(
            () => {
              this.pointColors[index * 3] = 255
              setTimeout(() => {
                this.pointColors[index * 3] = 0
              }, 500)
            },
              '1m'
          ).start(Tone.Transport.seconds + time)
        }
        loop.humanize = '64n'
        this.loops.push(loop)
        this.loopMap[timeLowRes] = true
      }
    }
  }
}
