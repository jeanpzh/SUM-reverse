export interface MatriculaInformacion {
    message:  null;
    codError: null;
    data:     Data;
}

export interface Data {
    codSemestre:       string;
    codFacultad:       number;
    fechaDB:           string;
    fecIniMatInternet: string;
    fecFinMatInternet: string;
    mensajeMatricula:  string;
    mensaje:           string;
    indMatHabilitada:  boolean;
    matriculado:       boolean;
    indMatCtrlHorario: string;
    valProgramacion:   null;
    perfil:            Perfil;
    creditaje:         { [key: string]: number };
    amonestaciones:    null;
}

export interface Perfil {
    anioIngreso:         number;
    anioEstudio:         number;
    promedio:            number;
    situAcademica:       string;
    permanencia:         string;
    semestreSuspension:  null;
    codTipoAutorizacion: null;
}
