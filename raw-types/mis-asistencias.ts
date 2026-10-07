export interface Asistencias {
    message:  null;
    codError: null;
    data:     Datum[];
}

export interface Datum {
    codAlumno:             string;
    apellidoMaterno:       null;
    apellidoPaterno:       null;
    nombreAlumno:          null;
    codSemestre:           string;
    codFacultad:           number;
    codEscuela:            number;
    codEspecialidad:       number;
    desEspecialidad:       string;
    codPlan:               string;
    codAsignatura:         string;
    desAsignatura:         string;
    codSeccion:            number;
    numClases:             number;
    cantPresentes:         number;
    cantFaltas:            number;
    cantTardanzas:         number;
    cantAsistencias:       number;
    porcentajePresentes:   number;
    porcentajeFaltas:      number;
    porcentajeTardanzas:   number;
    porcentajeAsistencias: number;
}
