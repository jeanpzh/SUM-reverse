export interface MatriculaFormularioDatos {
    message:  null;
    codError: null;
    data:     Data;
}

export interface Data {
    alumno:                         Alumno;
    formulario:                     { [key: string]: number | null };
    politicaPrivacidad:             null;
    llenar:                         boolean;
    datosPersonalesCompletado:      boolean;
    colegioCompletado:              boolean;
    actividadProfesionalCompletado: boolean;
    dependenciaEconomicaCompletado: boolean;
    recursosEstudioCompletado:      boolean;
    transporteCompletado:           boolean;
    saludCompletado:                boolean;
    interesAcademicoCompletado:     boolean;
    contactoCompletado:             boolean;
}

export interface Alumno {
    codAlumno:            string;
    apePaterno:           string;
    apeMaterno:           string;
    nomAlumno:            string;
    codFacultad:          number;
    desFacultad:          string;
    areaFacultad:         number;
    codEscuela:           number;
    desEscuela:           string;
    areaEscuela:          number;
    codEspecialidad:      number;
    desEspecialidad:      string;
    codPlan:              string;
    desPlan:              string;
    ponderado:            number;
    actualizoFormulario:  boolean;
    habEncuesta:          boolean;
    habEncuestaEgresados: boolean;
    habMatricula:         boolean;
    periodo:              string;
    urlFoto:              string;
    foto:                 string;
    codPermanencia:       string;
    desPermanencia:       string;
    codSituacion:         string;
    desSituacion:         string;
    regimen:              string;
    egresadoEG:           string;
    cicloEstudios:        number;
    anioIngreso:          number;
    correoInstitucional:  string;
    sexo:                 string;
    nroTicketMatEG:       number;
    infoSemestre:         InfoSemestre;
    infoMatricula:        InfoMatricula;
    anioEstudio:          number;
    codSede:              string;
    sedeAlumno:           string;
    difCriterioCalif:     boolean;
}

export interface InfoMatricula {
    fecInicioMatInternet:   string;
    fecFinMatInternet:      string;
    indMatInternet:         string;
    indMatObservados:       string;
    indMatDeudores:         string;
    indMatIngresantes:      string;
    indMatExonerados:       string;
    indMatRepMultiple:      string;
    indProgramacionInterna: string;
    indPagosAdicionales:    string;
    obsSemMatInternet:      null;
    indCertificadoMed:      string;
    indHabMatricula:        string;
    numMaxRepitencias:      number;
    indAutoSeguro:          string;
    indMatCtrlHorario:      string;
    sfecInicioMatInternet:  string;
    sfecFinMatInternet:     string;
}

export interface InfoSemestre {
    fecSistema:                 null;
    fecInicioEncuestaDocente:   Date;
    fecFinEncuestaDocente:      Date;
    fecInicioEncuestaDocenteS1: Date;
    fecFinEncuestaDocenteS1:    Date;
    fecInicioEncuestaDocenteS2: Date;
    fecFinEncuestaDocenteS2:    Date;
    fecInicioEncuestaDocenteA1: Date;
    fecFinEncuestaDocenteA1:    Date;
    fecInicioEncuestaDocenteA2: Date;
    fecFinEncuestaDocenteA2:    Date;
}
