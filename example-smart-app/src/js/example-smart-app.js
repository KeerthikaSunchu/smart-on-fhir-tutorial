<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Example-SMART-App</title>
    <!-- Include jQuery library -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
</head>
<body>
    <div id="errors"></div>
    <div id="loading">Loading...</div>
    <div id="holder" style="display:none;">
        <h2>Patient Resource</h2>
        <table>
            <tr>
                <th>First Name:</th>
                <td id="fname"></td>
            </tr>
            <tr>
                <th>Last Name:</th>
                <td id="lname"></td>
            </tr>
            <tr>
                <th>Gender:</th>
                <td id="gender"></td>
            </tr>
            <tr>
                <th>Date of Birth:</th>
                <td id="birthdate"></td>
            </tr>
            <tr>
                <th>Age:</th>
                <td id="age"></td>
            </tr>
        </table>
        <h2>Observation Resource</h2>
        <table>
            <tr>
                <th>Height:</th>
                <td id="height"></td>
            </tr>
            <tr>
                <th>Systolic Blood Pressure:</th>
                <td id="systolicbp"></td>
            </tr>
            <tr>
                <th>Diastolic Blood Pressure:</th>
                <td id="diastolicbp"></td>
            </tr>
            <tr>
                <th>LDL:</th>
                <td id="ldl"></td>
            </tr>
            <tr>
                <th>HDL:</th>
                <td id="hdl"></td>
            </tr>
        </table>
    </div>
    <!-- Include FHIR client library -->
    <script src="./lib/fhir-client.js"></script>
    <!-- Your custom script -->
    <script src="./src/js/example-smart-app.js"></script>
    <script>
        FHIR.oauth2.authorize({
            client_id: '5463aebd-19b7-4311-bcd4-e77c46793d77',
            scope: 'patient/Patient.read patient/Observation.read launch online_access openid profile',
            iss: 'https://r4.smarthealthit.org'
        });
        
        function extractData() {
            var ret = $.Deferred();
            FHIR.oauth2.ready(function(smart) {
                if (smart.hasOwnProperty('patient')) {
                    var patient = smart.patient;
                    var pt = patient.read();
                    var obv = smart.patient.api.fetchAll({
                        type: 'Observation',
                        query: {
                            code: {
                                $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                                      'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                                      'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                            }
                        }
                    });

                    $.when(pt, obv).fail(function() {
                        $('#errors').html('<p> Failed to call FHIR Service </p>');
                    });

                    $.when(pt, obv).done(function(patient, obv) {
                        var byCodes = smart.byCodes(obv, 'code');
                        var gender = patient.gender;
                        var dob = new Date(patient.birthDate);
                        var day = dob.getDate();
                        var monthIndex = dob.getMonth() + 1;
                        var year = dob.getFullYear();
                        var dobStr = monthIndex + '/' + day + '/' + year;
                        var fname = '';
                        var lname = '';

                        if (typeof patient.name[0] !== 'undefined') {
                            fname = patient.name[0].given.join(' ');
                            lname = patient.name[0].family.join(' ');
                        }

                        var height = byCodes('8302-2');
                        var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
                        var diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
                        var hdl = byCodes('2085-9');
                        var ldl = byCodes('2089-1');

                        var p = defaultPatient();
                        p.birthdate = dobStr;
                        p.gender = gender;
                        p.fname = fname;
                        p.lname = lname;
                        p.age = parseInt(calculateAge(dob));

                        if (typeof height[0] !== 'undefined' && typeof height[0].valueQuantity.value !== 'undefined' && typeof height[0].valueQuantity.unit !== 'undefined') {
                            p.height = height[0].valueQuantity.value + ' ' + height[0].valueQuantity.unit;
                        }

                        if (typeof systolicbp !== 'undefined') {
                            p.systolicbp = systolicbp;
                        }

                        if (typeof diastolicbp !== 'undefined') {
                            p.diastolicbp = diastolicbp;
                        }

                        if (typeof hdl[0] !== 'undefined' && typeof hdl[0].valueQuantity.value !== 'undefined' && typeof hdl[0].valueQuantity.unit !== 'undefined') {
                            p.hdl = hdl[0].valueQuantity.value + ' ' + hdl[0].valueQuantity.unit;
                        }

                        if (typeof ldl[0] !== 'undefined' && typeof ldl[0].valueQuantity.value !== 'undefined' && typeof ldl[0].valueQuantity.unit !== 'undefined') {
                            p.ldl = ldl[0].valueQuantity.value + ' ' + ldl[0].valueQuantity.unit;
                        }

                        ret.resolve(p);
                    });
                } else {
                    $('#errors').html('<p> Failed to call FHIR Service </p>');
                }
            });
            return ret.promise();
        }

        function drawVisualization(p) {
            $('#holder').show();
            $('#loading').hide();
            $('#fname').html(p.fname);
            $('#lname').html(p.lname);
            $('#gender').html(p.gender);
            $('#birthdate').html(p.birthdate);
            $('#age').html(p.age);
            $('#height').html(p.height);
            $('#systolicbp').html(p.systolicbp);
            $('#diastolicbp').html(p.diastolicbp);
            $('#ldl').html(p.ldl);
            $('#hdl').html(p.hdl);
        }

        function defaultPatient() {
            return {
                fname: '',
                lname: '',
                gender: '',
                birthdate: '',
                age: '',
                height: '',
                systolicbp: '',
                diastolicbp: '',
                ldl: '',
                hdl: ''
            };
        }

        function getBloodPressureValue(BPObservations, typeOfPressure) {
            var formattedBPObservations = [];
            BPObservations.forEach(function(observation) {
                var BP = observation.component.find(function(component) {
                    return component.code.coding.find(function(coding) {
                        return coding.code === typeOfPressure;
                    });
                });
                if (BP) {
                    formattedBPObservations.push(BP.valueQuantity.value);
                }
            });

            return formattedBPObservations.length > 0 ? formattedBPObservations[0] : undefined;
        }

        function calculateAge(dob) {
            var diff_ms = Date.now() - dob.getTime();
            var age_dt = new Date(diff_ms);
            return Math.abs(age_dt.getUTCFullYear() - 1970);
        }

        $(document).ready(function() {
            extractData().then(function(p) {
                drawVisualization(p);
            });
        });
    </script>
</body>
</html>
