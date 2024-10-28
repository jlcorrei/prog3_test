/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
const CAT_URL = "https://raw.githubusercontent.com/jlcorrei/prog3/refs/heads/gh-pages/cat.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0);  // default eye position in world space
var Center = new vec3.fromValues(0.5, 0.5, 0);
var viewUp = new vec3.fromValues(0, 1, 0);
var lookAt = new vec3.fromValues(0, 0, 1);

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib;

var vertexBuffers = []; // this contains vertex coordinates in triples
var normalBuffers = [];
var triangleBuffers = [];
var trianglesPerSet = [];

var numTriSets = 0;
var inputTriangles = [];

var lightPosition = vec3.fromValues(-0.5, 1.5, -0.5);
var lightColor = vec3.fromValues(1.0,1.0,1.0);

var ambientUniform;
var diffuseUniform;
var specularUniform;
var shininessUniform;

var modelMatrixUniform;
var mvpMatrixUniform;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers

function loadTriangles(thisURL) {
    inputTriangles = getJSONFile(thisURL,"triangles");
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vertex;
        var normal;
        var triangle;
        var vertexMax = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); 
        var vertexMin = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); 
        
        numTriSets = inputTriangles.length;
        for (var whichSet = 0; whichSet < numTriSets; whichSet++) {
            inputTriangles[whichSet].center = vec3.fromValues(0,0,0);
            inputTriangles[whichSet].x = vec3.fromValues(1,0,0); 
            inputTriangles[whichSet].y = vec3.fromValues(0,1,0);
            inputTriangles[whichSet].highlighted = false;
            inputTriangles[whichSet].translation = vec3.fromValues(0,0,0);
            inputTriangles[whichSet].rotation = mat4.create();

            // set up the vertex coord and normal arrays
            inputTriangles[whichSet].myVertices = [];
            inputTriangles[whichSet].myNormals = [];
            var numVertices = inputTriangles[whichSet].vertices.length;
            for (whichSetVert = 0; whichSetVert < numVertices; whichSetVert++){
                vertex = inputTriangles[whichSet].vertices[whichSetVert];
                normal = inputTriangles[whichSet].normals[whichSetVert];
                inputTriangles[whichSet].myVertices.push(vertex[0], vertex[1], vertex[2]);
                inputTriangles[whichSet].myNormals.push(normal[0], normal[1], normal[2]);
                // set model center and bounds
                vec3.max(vertexMax, vertexMax, vertex); 
                vec3.min(vertexMin, vertexMin, vertex); 
                vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vertex);
            }
            vec3.scale(inputTriangles[whichSet].center, inputTriangles[whichSet].center, 1 / numVertices);
            
            vertexBuffers[whichSet] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].myVertices), gl.STATIC_DRAW);

            normalBuffers[whichSet] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].myNormals), gl.STATIC_DRAW);

            inputTriangles[whichSet].myTriangles = [];
            trianglesPerSet[whichSet] = inputTriangles[whichSet].triangles.length;
            for (var whichSetTri = 0; whichSetTri < trianglesPerSet[whichSet]; whichSetTri++) {
                triangle = inputTriangles[whichSet].triangles[whichSetTri];
                inputTriangles[whichSet].myTriangles.push(triangle[0], triangle[1], triangle[2]);
            }

            triangleBuffers.push(gl.createBuffer())
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputTriangles[whichSet].myTriangles), gl.STATIC_DRAW);
    
        } // end for each triangle set 
        // send the vertex coords to webGL
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;

        varying vec3 fragNormal;
        varying vec3 fragPosition;

        uniform vec3 lightPosition;
        uniform vec3 viewPosition;
        uniform vec3 lightColor;

        uniform vec3 ambientColor;
        uniform vec3 diffuseColor;
        uniform vec3 specularColor;
        uniform float shininess;

        void main(void) {
            vec3 ambient = ambientColor * lightColor;

            vec3 normal = normalize(fragNormal);
            vec3 lightDir = normalize(lightPosition - fragPosition);
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diffuseColor * lightColor * diff;

            vec3 viewDir = normalize(viewPosition - fragPosition);
            vec3 reflectDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(normal, reflectDir), 0.0), shininess);
            vec3 specular = specularColor * lightColor * spec;

            vec3 finalColor = ambient + diffuse + specular;
            gl_FragColor = vec4(finalColor, 1.0); // final color
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        varying vec3 fragNormal;
        varying vec3 fragPosition;
  
        uniform mat4 modelMatrix;
        uniform mat4 mvpMatrix;

        void main(void) {

            vec4 fragPos4 = modelMatrix * vec4(vertexPosition, 1.0);
            fragPosition = vec3(fragPos4.x, fragPos4.y, fragPos4.z);
            gl_Position = mvpMatrix * vec4(vertexPosition, 1.0);

            vec4 fragNormal4 = modelMatrix * vec4(vertexNormal, 0.0);
            fragNormal = normalize(vec3(fragNormal4.x, fragNormal4.y, fragNormal4.z));
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);

                var viewPositionUniform = gl.getUniformLocation(shaderProgram, "viewPosition");
                var lightColorUniform = gl.getUniformLocation(shaderProgram, "lightColor");
                var lightPositionUniform = gl.getUniformLocation(shaderProgram, "lightPosition");

                gl.uniform3fv(lightPositionUniform, lightPosition);
                gl.uniform3fv(viewPositionUniform, [Eye[0], Eye[1], Eye[2]]);
                gl.uniform3fv(lightColorUniform, lightColor);

                ambientUniform = gl.getUniformLocation(shaderProgram, "ambientColor");
                diffuseUniform = gl.getUniformLocation(shaderProgram, "diffuseColor");
                specularUniform = gl.getUniformLocation(shaderProgram, "specularColor");
                shininessUniform = gl.getUniformLocation(shaderProgram, "shininess");

                modelMatrixUniform = gl.getUniformLocation(shaderProgram, "modelMatrix");
                mvpMatrixUniform = gl.getUniformLocation(shaderProgram, "mvpMatrix");
                
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
    altPosition = false;
    setTimeout(function alterPosition() {
        altPosition = !altPosition;
        setTimeout(alterPosition, 2000);
    }, 2000); // switch flag value every 2 seconds
} // end setup shaders
var bgColor = 0;
// render the loaded model
function renderTriangles() {

    function getRotationMatrix(x, y, z) {
        return mat4.fromValues(
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            0, 0, 0, 1
        );
    }

    function getModel(thisModel) {
        var z = vec3.create();
        var rotationMatrix = mat4.create();
        var tempMatrix = mat4.create();
        var negCenter = vec3.create();
        // translate model to origin
        mat4.fromTranslation(modelMatrix, vec3.negate(negCenter, thisModel.center));
        if (thisModel.highlighted) {
            // scale model by 1.2 for highlighting
            mat4.multiply(modelMatrix, mat4.fromScaling(tempMatrix, vec3.fromValues(1.2,1.2,1.2)), modelMatrix);
        }
        // rotate model using new z-axis
        vec3.normalize(z, vec3.cross(z, thisModel.x, thisModel.y));
        rotationMatrix = getRotationMatrix(thisModel.x, thisModel.y, z);
        // update model matrix based on rotation matrix
        mat4.multiply(modelMatrix, rotationMatrix, modelMatrix);
        // translate model back to original center
        mat4.multiply(modelMatrix, mat4.fromTranslation(tempMatrix, thisModel.center), modelMatrix);
        // translate model to final position
        mat4.multiply(modelMatrix, mat4.fromTranslation(tempMatrix, thisModel.translation), modelMatrix);
    }

    var projectionMatrix = mat4.create();
    var viewMatrix = mat4.create();
    var modelMatrix = mat4.create();
    var pvMatrix = mat4.create();
    var mvpMatrix = mat4.create();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    // bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    gl.clearColor(bgColor, 0, 0, 1.0);

    requestAnimationFrame(renderTriangles);

    mat4.perspective(projectionMatrix, 0.5 * Math.PI, 1, 0.1, 10);
    mat4.lookAt(viewMatrix, [Eye[0], Eye[1], Eye[2]], Center, viewUp);
    mat4.multiply(pvMatrix, projectionMatrix, viewMatrix);

    var thisModel;
    for (var whichSetTri = 0; whichSetTri < numTriSets; whichSetTri++) {
        thisModel = inputTriangles[whichSetTri];
        getModel(thisModel);
        mat4.multiply(mvpMatrix, pvMatrix, modelMatrix);

        gl.uniformMatrix4fv(modelMatrixUniform, false, modelMatrix);
        gl.uniformMatrix4fv(mvpMatrixUniform, false, mvpMatrix);

        gl.uniform3fv(ambientUniform, thisModel.material.ambient);
        gl.uniform3fv(diffuseUniform, thisModel.material.diffuse);
        gl.uniform3fv(specularUniform, thisModel.material.specular);
        gl.uniform1f(shininessUniform, thisModel.material.n);

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSetTri]);
        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSetTri]);
        gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSetTri]);
        gl.drawElements(gl.TRIANGLES, 3 * trianglesPerSet[whichSetTri], gl.UNSIGNED_SHORT, 0); // new rendering

    }
    // gl.drawArrays(gl.TRIANGLES,0,3); // render
} // end render triangles

var triangleIndex = -1; 
var thisTriangle = null; 
var prevTriangle = null;
var tempIndex;

function modelInteraction(event) {
    const amount = 0.1;
    const speed = Math.PI / 50;
    var viewRight = vec3.create();
    var tempVector = vec3.create();
    viewRight = vec3.normalize(viewRight, vec3.cross(tempVector, lookAt, viewUp));

    function highlightTriangle(thisIndex) {
        if (prevTriangle != null) {
            prevTriangle.highlighted = false;
        }
        thisTriangle = inputTriangles[thisIndex];
        thisTriangle.highlighted = true;
        prevTriangle = thisTriangle;
        triangleIndex = thisIndex;
    }

    function rotateTriangle(rotationAxis, angle) {
        if (thisTriangle != null) {
            var rotationMatrix = mat4.create();
            mat4.fromRotation(rotationMatrix, angle, rotationAxis);
            vec3.transformMat4(thisTriangle.x, thisTriangle.x, rotationMatrix);
            vec3.transformMat4(thisTriangle.y, thisTriangle.y, rotationMatrix);
        }
    }

    function translateTriangle(translationAmount) {
        if (thisTriangle != null) {
            vec3.add(thisTriangle.translation, thisTriangle.translation, translationAmount);
        }
    }
    
    switch (event.key) {
        // translate view left along x
        case 'a':
            Eye[0] -= amount;
            Center[0] -= amount;
            break;
        // translate view right along x
        case 'd':
            Eye[0] += amount;
            Center[0] += amount;
            break;
        // translate view forward along z
        case 'w':
            Eye[2] += amount;
            Center[2] += amount;
            break;
        // translate view backward along z
        case 's':
            Eye[2] -= amount;
            Center[2] -= amount;
            break;
        // translate view up along y
        case 'q':
            Eye[1] -= amount;
            Center[1] -= amount;
            break; 
        // translate view down along y
        case 'e':
            Eye[1] += amount;
            Center[1] += amount;
            break;
        case 'k':
            translateTriangle(vec3.scale(tempVector, viewRight, -amount));
            break;
        case ';':
            translateTriangle(vec3.scale(tempVector, viewRight, amount));
            break;
        case 'o':
            translateTriangle(vec3.scale(tempVector, lookAt, -amount));
            break;
        case 'l':
            translateTriangle(vec3.scale(tempVector, lookAt, amount));
            break;
        case 'i':
            translateTriangle(vec3.scale(tempVector, viewUp, amount));
            break;
        case 'p':
            translateTriangle(vec3.scale(tempVector, viewUp, -amount));
            break;
        case ':':
            rotateTriangle(viewUp, -speed);
            break;
        case '!':
            loadTriangles(CAT_URL);
            setupShaders();
            renderTriangles();
            break;
        default:
            break;
    }
    switch (event.code) {
        case "KeyA":
        case "KeyD":
            if (event.getModifierState("Shift")) {
                var angle;
                if (event.code === "KeyA") {
                    angle = speed;
                } else {
                    angle = -speed;
                }
                var cosAngle = Math.cos(angle);
                var sinAngle = Math.sin(angle);
                var newX = cosAngle * (Center[0] - Eye[0]) - sinAngle * (Center[2] - Eye[2]) + Eye[0];
                var newZ = sinAngle * (Center[0] - Eye[0]) + cosAngle * (Center[2] - Eye[2]) + Eye[2];
                Center[0] = newX;
                Center[2] = newZ;
            }
            break;
        case "KeyW":
        case "KeyS":
            if (event.getModifierState("Shift")) {
                var angle;
                if (event.code === "KeyW") {
                    angle = speed;
                } else {
                    angle = -speed;
                }
                var cosAngle = Math.cos(angle);
                var sinAngle = Math.sin(angle);
                var newY = cosAngle * (Center[1] - Eye[1]) - sinAngle * (Center[2] - Eye[2]) + Eye[1];
                var newZ = sinAngle * (Center[1] - Eye[1]) + cosAngle * (Center[2] - Eye[2]) + Eye[2];
                Center[1] = newY;
                Center[2] = newZ;
            }
            break;
        case "Space":
            if (thisTriangle != null) {
                thisTriangle.highlighted = false;
                thisTriangle = null;
                prevTriangle = null;
                triangleIndex = -1;
            }
            break;
        case "ArrowRight":
        case "ArrowLeft":
            if (event.code === "ArrowRight") {
                if (triangleIndex + 1 < numTriSets) {
                    tempIndex = triangleIndex + 1;
                } else {
                    tempIndex = 0;
                }
            } else {
                if (triangleIndex - 1 >= 0) {
                    tempIndex = triangleIndex - 1;
                } else {
                    tempIndex = numTriSets - 1;
                }
            }
            highlightTriangle(tempIndex);
            break;
        case "KeyK":
            if (event.getModifierState("Shift")) {
                rotateTriangle(viewUp, speed);
            }
            break;
        case "KeyL":
            if (event.getModifierState("Shift")) {
                rotateTriangle(viewRight, speed);
            } 
            break;
        case "KeyO":
            if (event.getModifierState("Shift")) {
                rotateTriangle(viewRight, -speed);
            } 
            break;
        case "KeyI":
            if (event.getModifierState("Shift")) {
                rotateTriangle(lookAt, -speed);
            } 
            break;
        case "KeyP":
            if (event.getModifierState("Shift")) {
                rotateTriangle(lookAt, speed);
            } 
            break;
    }
    viewingTransform = mat4.create();
    mat4.lookAt(viewingTransform, Eye, lookAt, viewUp);
}
document.addEventListener('keydown', modelInteraction);

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(INPUT_TRIANGLES_URL); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
} // end main

