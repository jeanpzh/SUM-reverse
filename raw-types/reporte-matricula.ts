export interface ReporteMatricula {
    message:  null;
    codError: null;
    data:     Data;
}

export interface Data {
    matricula:              Matricula[];
    datosMatricula:         DatosMatricula;
    indMatHabilitadaLabPra: boolean;
    codFacultad:            number;
}

export interface DatosMatricula {
    fechaMatricula: string;
    codOrientacion: string;
    tipoMatricula:  string;
}

export interface Matricula {
    codSemestre:          null;
    codFacultad:          number;
    desFacultad:          string;
    codEscuela:           number;
    desEscuela:           string;
    codEspecialidad:      number;
    codAsignatura:        string;
    desAsignatura:        string;
    codPlan:              string;
    desPlan:              string;
    codSeccion:           number;
    creditoAsignatura:    number;
    numRepitencias:       number;
    numRepitenciasEquiv:  number;
    codAlumno:            null;
    nomAlumno:            null;
    apePatAlumno:         null;
    apeMatAlumno:         null;
    nomDocente:           string;
    creditosMatriculados: number;
    cicloEstudio:         number;
    horario:              number;
    codAula:              string;
    codTurno:             null;
    tipoHorario:          null;
    anioIngreso:          null;
    correoIntitucional:   null;
    etapa:                null;
    sexo:                 string;
    usuarioMatricula:     null;
    fechaMatricula:       null;
    apePatDocente:        string;
    apeMatDocente:        string;
}
