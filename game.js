import "./style.css";

import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let camera, scene, renderer;
let controls, water, sun;
let timeElapsed = 0;

const SHIP_SPEED = 1.5;
const BOAT_SPEED = 1.0;

const oceanAudio = new Audio("sounds/ocean.mp3");
const chestAudio = new Audio("sounds/chest.mp3");
const shipAudio = new Audio("sounds/ship.mp3");
const firingAudio = new Audio("sounds/firing.mp3");
const reelingAudio = new Audio("sounds/reeling.mp3");

const loader = new GLTFLoader();

class Ship {
    constructor() {
        loader.load("textures/ship/scene.gltf", (gltf) => {
            const ship = gltf.scene;

            ship.scale.set(4, 4, 4);
            ship.position.set(0, -60, 0);
            ship.rotation.y = (90 * Math.PI) / 180;

            scene.add(ship);

            this.ship = ship;
            this.speed = {
                velocity: 0,
                rotation: 0,
            };
            this.movement = {
                forward: false,
                backward: false,
                left: false,
                right: false,
                boost: false,
            };
        });
    }

    getPosition() {
        return this.boat.position;
    }

    getRotation() {
        return this.boat.rotation;
    }

    update() {
        if (this.ship) {
            if (this.movement.forward) {
                this.speed.velocity = SHIP_SPEED;
            } else if (!this.movement.backward) {
                this.speed.velocity = 0;
            }

            if (this.movement.backward) {
                this.speed.velocity = -SHIP_SPEED;
            } else if (!this.movement.forward) {
                this.speed.velocity = 0;
            }

            if (this.movement.left) {
                this.speed.rotation = 0.025;
            } else if (!this.movement.right) {
                this.speed.rotation = 0;
            }

            if (this.movement.right) {
                this.speed.rotation = -0.025;
            } else if (!this.movement.left) {
                this.speed.rotation = 0;
            }

            if (this.movement.backward) this.speed.rotation *= -1;

            if (this.movement.boost) {
                if (this.movement.forward || this.movement.backward) {
                    this.speed.velocity = this.speed.velocity * 2;
                }
                if (this.movement.left || this.movement.right) {
                    this.speed.rotation = this.speed.rotation * 2;
                }
            }

            this.ship.rotation.y += this.speed.rotation;
            this.ship.translateX(this.speed.velocity);

            camera.rotation.y += this.speed.rotation;
            camera.translateX(this.speed.velocity);
        }
    }

    stop() {
        this.speed.velocity = 0;
        this.speed.rotation = 0;
    }

    reset() {
        this.ship.position.set(0, -60, 0);
        this.ship.rotation.y = (90 * Math.PI) / 180;
        this.ship.visible = true;
    }

    hide() {
        this.ship.visible = !this.ship.visible;
    }
}

const ship = new Ship();
class Boat {
    constructor(GLTFscene) {
        const boat = GLTFscene;

        let max = 1000;
        let min = -max;

        let randomX = 0;
        let randomZ = 0;

        let shipX = 15;
        let shipZ = 15;

        while (
            Math.abs(randomX - shipX) <= 200 &&
            Math.abs(randomZ - shipZ) <= 200
        ) {
            randomX = Math.floor(Math.random() * (max - min + 1)) + min;
            randomZ = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        boat.scale.set(0.05, 0.05, 0.05);
        boat.position.set(randomX, 0, randomZ);

        scene.add(boat);

        this.boat = boat;
        this.speed = {
            velocity: 0,
            rotation: 0,
        };
        this.movement = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };
    }

    update(shipPosition, shipRotation) {
        this.speed.velocity = BOAT_SPEED;
        this.boat.translateX(this.speed.velocity);

        let boatPosition = this.boat.position;

        if (shipPosition.x > boatPosition.x) {
            this.boat.rotation.y += 0.1;
        }
    }

    stop() {
        this.speed.velocity = 0;
        this.speed.rotation = 0;
    }

    reset() {
        this.boat.position.set(15, -60, 60);
        this.boat.rotation.y = 0;
        this.boat.visible = true;
    }

    hide() {
        this.boat.visible = !this.boat.visible;
    }

    remove() {
        scene.remove(this.boat);
    }
}

class Chest {
    constructor(GLTFscene) {
        const chest = GLTFscene;

        let max = 1000;
        let min = -max;

        let randomX = 0;
        let randomZ = 0;

        let shipX = 15;
        let shipZ = 15;

        while (Math.abs(randomX - shipX) <= 200) {
            randomX = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        while (Math.abs(randomZ - shipZ) <= 200) {
            randomZ = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        chest.scale.set(20, 20, 20);
        chest.position.set(randomX, 0, randomZ);

        scene.add(chest);

        this.chest = chest;
    }

    update() {
        if (this.chest) {
            this.chest.rotation.y += 0.05;
        }
    }

    remove() {
        scene.remove(this.chest);
    }
}

class Diamond {
    constructor(GLTFscene, chestPosition) {
        const diamond = GLTFscene;

        diamond.scale.set(0.5, 0.5, 0.5);
        diamond.position.set(
            chestPosition.x,
            chestPosition.y + 100,
            chestPosition.z
        );

        scene.add(diamond);

        this.diamond = diamond;
        this.isColliding = false;
    }

    update(chest, chestPosition) {
        if (this.diamond) {
            this.diamond.rotation.y += 0.05;
        }

        if (this.isColliding) {
            this.diamond.position.y -= 0.5;
            reelingAudio.play();
        } else {
            if (this.diamond.position.y == chestPosition.y + 100) return;
            this.diamond.position.y += 0.5;
        }

        if (this.diamond.position.y == chestPosition.y + 30) {
            chests_looted += 1;

            reelingAudio.pause();
            chestAudio.play();

            this.isColliding = false;

            return "chest_looted";
        }

        return "chest_not_looted";
    }

    remove() {
        scene.remove(this.diamond);
    }
}

class CanonBall {
    constructor(GLTFscene, cannonPosition) {
        const canonBall = GLTFscene;

        canonBall.scale.set(0.5, 0.5, 0.5);
        canonBall.position.set(
            cannonPosition.x,
            cannonPosition.y,
            cannonPosition.z
        );

        scene.add(canonBall);

        this.canonBall = canonBall;
    }

    update() {
        if (this.canonBall) {
            this.canonBall.rotation.y += 0.05;
        }
    }

    remove() {
        scene.remove(this.canonBall);
    }
}

let dummyModel = null;

async function loadModel(URI) {
    return new Promise((resolve, reject) => {
        loader.load(URI, (gltf) => {
            resolve(gltf.scene);
        });
    });
}

let chests_looted = 0;

let chests = [];
let N_CHESTS = 15;

let diamonds = [];
let N_DIAMONDS = N_CHESTS;

async function createChest() {
    if (!dummyModel) dummyModel = await loadModel("textures/chest/scene.gltf");
    return new Chest(dummyModel.clone());
}

async function createDiamond(chestPosition) {
    if (!dummyModel)
        dummyModel = await loadModel("textures/diamond/scene.gltf");
    return new Diamond(dummyModel.clone(), chestPosition);
}

let boats = [];
let N_BOATS = 3;

async function createBoat() {
    if (!dummyModel) dummyModel = await loadModel("textures/boat/scene.gltf");
    return new Boat(dummyModel.clone());
}

init();
animate();

function renderText(string, color, left, top) {
    let text = document.createElement("div");
    text.style.position = "absolute";

    text.style.width = "100%";
    text.style.height = "100%";
    text.style.top = top + "px";
    text.style.left = left + "px";
    text.style.fontSize = "50px";
    text.style.fontFamily = "Voltaire";
    text.style.fontWeight = "bold";
    text.style.zIndex = "1";

    text.innerHTML = string;
    text.style.color = color;
    document.body.appendChild(text);
}

async function init() {
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);

    //

    var link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("type", "text/css");
    link.setAttribute(
        "href",
        "https://fonts.googleapis.com/css?family=Voltaire"
    );
    document.head.appendChild(link);

    // renderText("Pirates", "#98C1D9", 10, 10);
    // renderText("of", "#EE6C4D", 150, 10);
    // renderText("Sabarmati", "#3D5A80", 10, 60);

    //

    scene = new THREE.Scene();

    const FOV = 60;
    const ASPECT = window.innerWidth / window.innerHeight;
    let NEAR = 0.1;
    const FAR = 2000;

    camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
    camera.position.set(0, 50, 100);

    //

    sun = new THREE.Vector3();

    // Water

    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

    water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load(
            "textures/ocean/ocean.jpg",
            function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }
        ),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xf0f0f0,
        waterColor: 0x001e0f,
        distortionScale: 1,
        fog: scene.fog !== undefined,
    });

    water.rotation.x = -Math.PI / 2;

    scene.add(water);

    if (water) {
        oceanAudio.play();
        oceanAudio.loop = true;
        oceanAudio.volume = 0.1;
    }

    // Skybox

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;

    skyUniforms["turbidity"].value = 10;
    skyUniforms["rayleigh"].value = 1;
    skyUniforms["mieCoefficient"].value = 0.001;
    skyUniforms["mieDirectionalG"].value = 0.8;

    const parameters = {
        elevation: 2,
        azimuth: 180,
    };

    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);

    sun.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms["sunPosition"].value.copy(sun);
    water.material.uniforms["sunDirection"].value.copy(sun).normalize();

    scene.environment = pmremGenerator.fromScene(sky).texture;

    //

    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 10, 0);
    controls.minDistance = 100.0;
    controls.maxDistance = 400.0;
    controls.update();

    //

    for (let i = 0; i < N_CHESTS; i++) {
        const chest = await createChest();
        chests.push(chest);
    }

    dummyModel = null;

    for (let i = 0; i < N_BOATS; i++) {
        const boat = await createBoat();
        boats.push(boat);
    }

    dummyModel = null;

    for (let i = 0; i < N_DIAMONDS; i++) {
        const diamond = await createDiamond(chests[i].chest.position);
        diamonds.push(diamond);
    }

    //

    window.addEventListener("resize", function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener("keydown", function (event) {
        const key = event.key;

        if (key == "ArrowUp" || key == "w") {
            ship.movement.forward = true;
        }

        if (key == "ArrowDown" || key == "s") {
            ship.movement.backward = true;
        }

        if (key == "ArrowLeft" || key == "a") {
            ship.movement.left = true;
        }

        if (key == "ArrowRight" || key == "d") {
            ship.movement.right = true;
        }

        if (key == "b") {
            ship.movement.boost = true;
        }

        if (key == " ") {
            ship.stop();
        }

        if (key == "h") {
            ship.hide();
        }

        if (key == "r") {
            ship.reset();
        }

        if (key == "m") {
            oceanAudio.muted = !oceanAudio.muted;
        }
    });

    window.addEventListener("keyup", function (event) {
        const key = event.key;

        if (key == "ArrowUp" || key == "w") {
            ship.movement.forward = false;
        }

        if (key == "ArrowDown" || key == "s") {
            ship.movement.backward = false;
        }

        if (key == "ArrowLeft" || key == "a") {
            ship.movement.left = false;
        }

        if (key == "ArrowRight" || key == "d") {
            ship.movement.right = false;
        }

        if (key == "b") {
            ship.movement.boost = false;
        }
    });
}

function isColliding(object1, object2) {
    const conditions = [
        object1.position.x - object2.position.x < 100,
        object1.position.x - object2.position.x > -100,
        object1.position.z - object2.position.z < 50,
        object1.position.z - object2.position.z > -50,
    ];

    return conditions.every((condition) => condition);
}

function checkCollisions() {
    if (ship.ship)
        for (let i = 0; i < chests.length; ++i)
            if (diamonds[i].diamond)
                diamonds[i].isColliding = isColliding(
                    ship.ship,
                    chests[i].chest
                );
}

shipAudio.loop = true;
shipAudio.volume = 0.5;
let isPlayingShipAudio = false;

function animate() {
    requestAnimationFrame(animate);

    timeElapsed += 1;

    document.getElementById("hud-top-time").innerHTML =
        (timeElapsed / 100).toFixed(1) + "s";
    document.getElementById("hud-top-score").innerHTML =
        chests_looted + " / " + N_CHESTS;

    ship.update();

    for (let i = 0; i < chests.length; i++) {
        chests[i].update();
    }

    for (let i = 0; i < diamonds.length; i++) {
        let status = diamonds[i].update(chests[i], chests[i].chest.position);
        if (status == "chest_looted") {
            diamonds[i].remove();
            diamonds.splice(i, 1);

            chests[i].remove();
            chests.splice(i, 1);

            i--;
        }
    }

    for (let i = 0; i < boats.length; i++) {
        if (ship.ship) {
            let shipPosition = ship.ship.position;
            let shipRotation = ship.ship.rotation.y;
            boats[i].update(shipPosition, shipRotation);
        }
    }

    if (ship.ship) {
        // console.log(
        //     "   " +
        //         (ship.movement.forward ? 1 : 0) +
        //         "\n" +
        //         (ship.movement.left ? 1 : 0) +
        //         "     " +
        //         (ship.movement.right ? 1 : 0) +
        //         "\n" +
        //         "   " +
        //         (ship.movement.backward ? 1 : 0) +
        //         "\n" +
        //         "   " +
        //         (ship.movement.boost ? 1 : 0) +
        //         "\n"
        // );
        let newPosition = new THREE.Vector3();

        newPosition.x =
            Math.cos(Math.PI - ship.ship.rotation.y) * 100 +
            ship.ship.position.x;
        newPosition.z =
            Math.sin(Math.PI - ship.ship.rotation.y) * 100 +
            ship.ship.position.z;
        newPosition.y = 50;

        camera.position.set(newPosition.x, newPosition.y, newPosition.z);

        let newLookAt = new THREE.Vector3();
        newLookAt.x = -(
            Math.cos(Math.PI - ship.ship.rotation.y) * 1000 -
            ship.ship.position.x
        );
        newLookAt.z = -(
            Math.sin(Math.PI - ship.ship.rotation.y) * 1000 -
            ship.ship.position.z
        );
        newLookAt.y = 50;

        camera.lookAt(newLookAt.x, newLookAt.y, newLookAt.z);

        if (isPlayingShipAudio == false) {
            // if atleast one movement key is pressed

            if (
                ship.movement.forward == true ||
                ship.movement.backward == true ||
                ship.movement.left == true ||
                ship.movement.right == true
            ) {
                shipAudio.volume = 0.5;
                shipAudio.play();
                isPlayingShipAudio = true;
            }
        } else if (isPlayingShipAudio == true) {
            if (
                ship.movement.forward == false &&
                ship.movement.backward == false &&
                ship.movement.left == false &&
                ship.movement.right == false
            ) {
                shipAudio.pause();

                isPlayingShipAudio = false;
            }
        }
    }

    checkCollisions();

    water.material.uniforms["time"].value += 1.0 / 60.0;
    renderer.render(scene, camera);
}
